import 'fake-indexeddb/auto'
import { BaseVoluntarios, PROYECTO_POR_DEFECTO } from '../db/db'
import type { Asistencia, Programacion, Voluntario } from '../db/tipos'
import {
  desmarcarLlegada, errorHoras, filasAsistencia, horaPropuesta, jornadaActual, marcarLlegada, resumenAsistencia,
  salidaGeneral, tareaPropuesta,
} from './asistencia'

const F = '2026-12-05'
const prog = (id: number, voluntarioId: number, confirmacion: Programacion['confirmacion'] = 'pendiente', tareaId: number | null = null): Programacion =>
  ({ id, fecha: F, jornada: 'M', voluntarioId, tareaId, confirmacion, mensajeEnviado: false })
const asis = (id: number, voluntarioId: number, asistio = true, horaSalida?: string): Asistencia =>
  ({ id, fecha: F, jornada: 'M', voluntarioId, asistio, horaLlegada: '07:05', horaSalida, observacion: '' })
const vols = new Map<number, Voluntario>(
  [[1, 'Zoe'], [2, 'Ana'], [3, 'Luis'], [4, 'Beto']].map(([id, nombre]) => [id as number, { id, nombre, tareaHabitualId: 9 } as Voluntario]),
)

describe('asistencia', () => {
  it('jornada actual y hora propuesta', () => {
    expect(jornadaActual(PROYECTO_POR_DEFECTO, new Date(2026, 11, 5, 9, 30))).toBe('M')
    expect(jornadaActual(PROYECTO_POR_DEFECTO, new Date(2026, 11, 5, 12, 0))).toBe('T')
    expect(horaPropuesta(F, 'M', PROYECTO_POR_DEFECTO, 'llegada', F, new Date(2026, 11, 5, 7, 4))).toBe('07:04')
    expect(horaPropuesta(F, 'T', PROYECTO_POR_DEFECTO, 'llegada', '2026-12-06')).toBe('13:00')
    expect(horaPropuesta(F, 'T', PROYECTO_POR_DEFECTO, 'salida', '2026-12-06')).toBe('17:00')
  })

  it('une programados y asistencias, con no programados', () => {
    const filas = filasAsistencia(
      [prog(1, 1), prog(2, 2, 'confirmado', 5), prog(3, 3, 'no_puede')],
      [asis(1, 2), asis(2, 4, true, '12:00')],
      vols,
    )
    expect(filas.map((f) => [f.nombre, f.presente, f.noProgramado])).toEqual([
      ['Ana', true, false], ['Beto', true, true], ['Zoe', false, false],
    ])
    expect(resumenAsistencia(filas)).toEqual({ programados: 2, presentes: 2, faltan: 1, noProgramados: 1, sinSalida: 1 })
    expect(tareaPropuesta(filas[0])).toBe(5)
    expect(tareaPropuesta(filas[2])).toBe(9)
  })

  it('quien dijo «no puede» y sí vino no cuenta como no programado', () => {
    const filas = filasAsistencia([prog(3, 3, 'no_puede')], [asis(1, 3)], vols)
    expect(filas[0]).toMatchObject({ nombre: 'Luis', presente: true, noProgramado: false })
  })

  it('marcar, desmarcar y salida general', async () => {
    const db = new BaseVoluntarios('asistencia-1')
    const a = await marcarLlegada(db, { fecha: F, jornada: 'M', voluntarioId: 1, tareaId: null }, '07:10')
    const b = await marcarLlegada(db, { fecha: F, jornada: 'M', voluntarioId: 1, tareaId: null }, '08:00')
    expect(a).toBe(b)
    expect((await db.asistencias.get(a))?.horaLlegada).toBe('07:10')
    await marcarLlegada(db, { fecha: F, jornada: 'M', voluntarioId: 2, tareaId: 3 }, '07:20')
    await db.asistencias.add({ fecha: F, jornada: 'M', voluntarioId: 3, asistio: true, horaLlegada: '07:00', horaSalida: '10:00', observacion: '' } as Asistencia)
    expect(await salidaGeneral(db, F, 'M', '12:00')).toBe(2)
    expect((await db.asistencias.where('voluntarioId').equals(3).first())?.horaSalida).toBe('10:00')
    await desmarcarLlegada(db, a)
    const d = await db.asistencias.get(a)
    expect(d?.asistio).toBe(false)
    expect(d?.horaLlegada).toBeUndefined()
    expect(d?.horaSalida).toBeUndefined()
  })

  it('valida horas', () => {
    expect(errorHoras('08:00', '07:00')).toMatch(/antes/)
    expect(errorHoras('08:00', '12:00')).toBeNull()
    expect(errorHoras(undefined, '12:00')).toBeNull()
  })
})
