import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import { coincideHabilidad, eliminarTarea, formATarea, formTareaVacio, guardarTarea, ordenarTareas, validarTarea } from './tareas'
import { guardarVoluntario } from './voluntarios'

describe('tareas', () => {
  it('valida nombre, número y fechas', () => {
    const f = { ...formTareaVacio(), personasNecesarias: 'x', fechaInicio: '2026-12-10', fechaFin: '2026-12-01' }
    expect(Object.keys(validarTarea(f)).sort()).toEqual(['fechaFin', 'nombre', 'personasNecesarias'])
    expect(validarTarea({ ...formTareaVacio(), nombre: 'Pintura', personasNecesarias: '6' })).toEqual({})
    expect(formATarea({ ...formTareaVacio(), nombre: ' Pintura  techo ', personasNecesarias: '6' })).toMatchObject({ nombre: 'Pintura techo', personasNecesarias: 6 })
  })

  it('ordena: en curso, pendientes, terminadas', () => {
    const l = ordenarTareas([
      { nombre: 'B', estado: 'terminada' as const },
      { nombre: 'C', estado: 'pendiente' as const },
      { nombre: 'A', estado: 'pendiente' as const },
      { nombre: 'Z', estado: 'en_curso' as const },
    ])
    expect(l.map((t) => t.nombre)).toEqual(['Z', 'A', 'C', 'B'])
  })

  it('coincidencia de habilidad tolerante', () => {
    expect(coincideHabilidad('Pintor', 'Pintura')).toBe(true)
    expect(coincideHabilidad('Electricista', 'Electricidad')).toBe(true)
    expect(coincideHabilidad('Albañil y plomería', 'Albañilería')).toBe(true)
    expect(coincideHabilidad('Plomero', 'plomería y desagües')).toBe(true)
    expect(coincideHabilidad('Carpintero', 'Pintura')).toBe(false)
    expect(coincideHabilidad('Cocina', 'Pintura')).toBe(false)
    expect(coincideHabilidad('', 'Pintura')).toBe(false)
    expect(coincideHabilidad('Pintor', '')).toBe(false)
  })

  it('al eliminar deja sin tarea a voluntarios y programación', async () => {
    const db = new BaseVoluntarios('tareas-1')
    const t = await guardarTarea(db, formATarea({ ...formTareaVacio(), nombre: 'Pintura' }))
    const v = await guardarVoluntario(db, {
      nombre: 'Ana', congregacionId: 1, invitado: false, invitadoMotivo: '', invitadoPor: '', tipo: 'Local', fechaNacimiento: '',
      profesion: '', celulares: [], emergenciaNombre: '', emergenciaCelular: '', disponibilidad: [null, null, null, null, null, null, 'D'],
      tareaHabitualId: t, observaciones: '',
    })
    await db.programaciones.add({ fecha: '2026-12-05', jornada: 'M', voluntarioId: v, tareaId: t, confirmacion: 'pendiente', mensajeEnviado: false } as never)
    await db.asistencias.add({ fecha: '2026-12-05', jornada: 'M', voluntarioId: v, asistio: true, tareaId: t, observacion: '' } as never)
    await db.dias.put({ fecha: '2026-12-05', cupoM: 5, cuposTarea: { [t]: 3 }, notas: '' })
    await eliminarTarea(db, t)
    expect((await db.voluntarios.get(v))?.tareaHabitualId).toBeNull()
    expect((await db.programaciones.toArray())[0].tareaId).toBeNull()
    expect((await db.asistencias.toArray())[0]).toMatchObject({ tareaId: null, tareaTexto: 'Pintura' })
    expect((await db.dias.get('2026-12-05'))?.cuposTarea).toEqual({})
    expect(await db.tareas.count()).toBe(0)
  })
})
