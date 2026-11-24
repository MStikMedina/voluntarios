import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import type { Disponibilidad, Programacion } from '../db/tipos'
import {
  agruparPorTarea, avisosAlProgramar, copiarProgramacion, cupoTarea, fechaInicialProgramacion, guardarCupo,
  guardarCupoTarea, otroDiaTrabajo, programar, resumenJornada, sugeridos, tareasDeFecha,
} from './programacion'

const SAB = '2026-12-05' // sábado
const disp = (sab: 'M' | 'T' | 'D' | null): Disponibilidad => [null, null, null, null, null, null, sab]
const vol = (id: number, nombre: string, profesion: string, sab: 'M' | 'T' | 'D' | null, tareaHabitualId: number | null = null) =>
  ({ id, nombre, profesion, disponibilidad: disp(sab), tareaHabitualId })
const p = (jornada: 'M' | 'T', confirmacion: Programacion['confirmacion'], tareaId: number | null) => ({ jornada, confirmacion, tareaId })

describe('programación', () => {
  const tareas = [
    { id: 1, nombre: 'Pintura', personasNecesarias: 2, habilidadRequerida: 'pintura', estado: 'en_curso' as const, fechaInicio: '', fechaFin: '' },
    { id: 2, nombre: 'Aseo', personasNecesarias: 0, habilidadRequerida: '', estado: 'pendiente' as const, fechaInicio: '2026-12-10', fechaFin: '' },
  ]

  it('cupo de tarea: ajustado por fecha o personas necesarias', () => {
    expect(cupoTarea(tareas[0], null)).toBe(2)
    expect(cupoTarea(tareas[0], { fecha: SAB, cuposTarea: { 1: 5 }, notas: '' })).toBe(5)
    expect(cupoTarea(tareas[1], null)).toBeNull()
  })

  it('resumen: los que no pueden no ocupan cupo', () => {
    const r = resumenJornada(
      [p('M', 'confirmado', 1), p('M', 'pendiente', 1), p('M', 'no_puede', 1), p('M', 'pendiente', null), p('T', 'pendiente', 1)],
      'M',
      { fecha: SAB, cupoM: 3, cupoT: null, cuposTarea: {}, notas: '' },
      tareas,
    )
    expect(r).toMatchObject({ cupo: 3, programados: 3, confirmados: 1, pendientes: 2, noPuede: 1, faltan: 0 })
    expect(r.porTarea).toEqual([
      { tareaId: 1, cupo: 2, programados: 2 },
      { tareaId: 2, cupo: null, programados: 0 },
      { tareaId: null, cupo: null, programados: 1 },
    ])
    expect(resumenJornada([], 'T', null, []).cupo).toBeNull()
  })

  it('tareas de la fecha', () => {
    expect(tareasDeFecha(tareas, SAB).map((t) => t.id)).toEqual([1])
    expect(tareasDeFecha(tareas, '2026-12-12').map((t) => t.id)).toEqual([1, 2])
  })

  it('sugeridos: disponibles, habitual y habilidad primero', () => {
    const vs = [vol(1, 'Zoe', 'Pintora', 'M'), vol(2, 'Ana', 'Cocina', 'D'), vol(3, 'Beto', 'Plomero', 'T'), vol(4, 'Carlos', 'Cocina', 'M', 1), vol(5, 'Dora', '', 'D')]
    const s = sugeridos(vs, SAB, 'M', new Set([5]), tareas[0])
    expect(s.map((x) => x.voluntario.nombre)).toEqual(['Carlos', 'Zoe', 'Ana'])
    expect(s[1].coincide).toBe(true)
    const todos = sugeridos(vs, SAB, 'M', new Set(), null, true)
    expect(todos.map((x) => x.voluntario.nombre)).toEqual(['Ana', 'Carlos', 'Dora', 'Zoe', 'Beto'])
    expect(todos[4].disponible).toBe(false)
  })

  it('avisos al programar', () => {
    const dia = { fecha: SAB, cupoM: 1, cuposTarea: {}, notas: '' }
    const r = resumenJornada([p('M', 'pendiente', 1), p('M', 'pendiente', 1)], 'M', dia, tareas)
    expect(avisosAlProgramar({ disponibilidad: disp('T') }, SAB, 'M', r, 1)).toEqual(['fuera_disponibilidad', 'cupo_superado', 'cupo_tarea_superado'])
    expect(avisosAlProgramar({ disponibilidad: disp('D') }, SAB, 'M', resumenJornada([], 'M', null, tareas), 1)).toEqual(['sin_cupo'])
  })

  it('fechas de trabajo', () => {
    expect(fechaInicialProgramacion([6], '2026-11-23')).toBe('2026-11-28')
    expect(fechaInicialProgramacion([1], '2026-11-23')).toBe('2026-11-23')
    expect(otroDiaTrabajo('2026-11-28', 1, [6, 0])).toBe('2026-11-29')
    expect(otroDiaTrabajo('2026-11-28', -1, [6])).toBe('2026-11-21')
    expect(otroDiaTrabajo('2026-11-28', 1, [])).toBe('2026-11-29')
  })

  it('agrupa por tarea', () => {
    const g = agruparPorTarea(
      [{ tareaId: 2, nombre: 'b' }, { tareaId: null, nombre: 'z' }, { tareaId: 1, nombre: 'y' }, { tareaId: 1, nombre: 'a' }],
      [{ id: 1, nombre: 'Pintura' }, { id: 2, nombre: 'Aseo' }],
    )
    expect(g.map((x) => [x.tarea?.nombre ?? '—', x.items.map((i) => i.nombre).join('')])).toEqual([['Pintura', 'ay'], ['Aseo', 'b'], ['—', 'z']])
  })

  it('guarda cupos, programa sin repetir y copia un día', async () => {
    const db = new BaseVoluntarios('prog-1')
    await guardarCupo(db, SAB, 'M', 10)
    await guardarCupo(db, SAB, 'T', 8)
    await guardarCupoTarea(db, SAB, 1, 4)
    expect(await db.dias.get(SAB)).toMatchObject({ cupoM: 10, cupoT: 8, cuposTarea: { 1: 4 } })
    await guardarCupoTarea(db, SAB, 1, null)
    expect((await db.dias.get(SAB))?.cuposTarea).toEqual({})
    const a = await programar(db, { fecha: SAB, jornada: 'M', voluntarioId: 7, tareaId: 1 })
    const b = await programar(db, { fecha: SAB, jornada: 'M', voluntarioId: 7, tareaId: 2 })
    expect(a).toBe(b)
    await programar(db, { fecha: SAB, jornada: 'T', voluntarioId: 7, tareaId: null })
    await db.programaciones.update(a, { confirmacion: 'confirmado' })
    const sig = '2026-12-12'
    expect(await copiarProgramacion(db, SAB, sig)).toBe(2)
    expect(await copiarProgramacion(db, SAB, sig)).toBe(0)
    const copiados = await db.programaciones.where('fecha').equals(sig).toArray()
    expect(copiados.every((x) => x.confirmacion === 'pendiente')).toBe(true)
    expect(await db.dias.get(sig)).toMatchObject({ cupoM: 10, cupoT: 8 })
  })
})
