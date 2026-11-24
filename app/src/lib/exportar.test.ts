import { PROYECTO_POR_DEFECTO } from '../db/db'
import type { Asistencia, Programacion, Tarea, Voluntario } from '../db/tipos'
import { filasDetalleAsistencia, filasHoras, filasListado, filasPorFecha, filasPorTarea, nombreArchivoExport } from './exportar'

const vol = (id: number, nombre: string, extra: Partial<Voluntario> = {}): Voluntario =>
  ({
    id, nombre, nombreNorm: nombre.toLowerCase(), congregacionId: 1, invitado: false, invitadoMotivo: '', invitadoPor: '', tipo: 'Local',
    fechaNacimiento: '1990-01-15', profesion: 'Pintor', profesionNorm: 'pintor', celulares: [{ numero: '3001112233', principal: true }, { numero: '3104445566', principal: false }],
    emergenciaNombre: 'Ana', emergenciaCelular: '3200000000', disponibilidad: [null, 'M', null, null, null, null, 'D'], tareaHabitualId: 1,
    observaciones: '', creado: '', actualizado: '', ...extra,
  }) as Voluntario
const vols = [vol(1, 'Zoe'), vol(2, 'Ana'), vol(3, 'Luis', { congregacionId: null, invitado: true })]
const congs = [{ id: 1, nombre: 'Central' }]
const tareas: Tarea[] = [
  { id: 1, nombre: 'Pintura', descripcion: '', fechaInicio: '', fechaFin: '', estado: 'en_curso', personasNecesarias: 4, habilidadRequerida: '' },
  { id: 2, nombre: 'Aseo', descripcion: '', fechaInicio: '', fechaFin: '', estado: 'pendiente', personasNecesarias: 0, habilidadRequerida: '' },
]
const A = (id: number, fecha: string, jornada: 'M' | 'T', voluntarioId: number, tareaId: number | null, asistio = true): Asistencia =>
  ({ id, fecha, jornada, voluntarioId, asistio, tareaId, horaLlegada: '07:00', observacion: '' })
const P = (fecha: string, jornada: 'M' | 'T', voluntarioId: number, tareaId: number | null, confirmacion: Programacion['confirmacion'] = 'pendiente'): Programacion =>
  ({ id: 0, fecha, jornada, voluntarioId, tareaId, confirmacion, mensajeEnviado: false })

// Jornadas por defecto: M 07–12 (5 h), T 13–17 (4 h).
const asistencias = [
  A(1, '2026-12-05', 'M', 1, 1), A(2, '2026-12-05', 'T', 1, 1), A(3, '2026-12-05', 'M', 2, null),
  A(4, '2026-12-12', 'M', 1, 2), A(5, '2026-12-12', 'M', 3, 1, false), A(6, '2026-12-12', 'M', 3, 1),
  A(7, '2027-01-09', 'M', 2, 1),
]
const programaciones = [
  P('2026-12-05', 'M', 1, 1, 'confirmado'), P('2026-12-05', 'T', 1, 1), P('2026-12-05', 'M', 3, 1, 'no_puede'),
  P('2026-12-12', 'M', 1, 2), P('2026-12-12', 'M', 2, 2),
]
const rango = { desde: '2026-12-01', hasta: '2026-12-31' }

describe('exportaciones', () => {
  it('listado con todos los campos', () => {
    const f = filasListado(vols, congs, tareas, '2026-11-23')
    expect(f[0]).toHaveLength(16)
    expect(f.map((x) => x[0])).toEqual(['Nombre', 'Ana', 'Luis', 'Zoe'])
    expect(f[1]).toEqual([
      'Ana', 'Central', 'Local', '15/01/1990', 36, 'Pintor', '300 111 2233', '310 444 5566', 'Ana', '320 000 0000', 'LU-M, SA-D', 'Pintura', '', '', '', '',
    ])
    expect(f[2][1]).toBe('')
    expect(f[2][12]).toBe('Sí')
  })

  it('horas por voluntario según el horario de la jornada', () => {
    const f = filasHoras(asistencias, vols, congs, PROYECTO_POR_DEFECTO, rango)
    expect(f.slice(1)).toEqual([
      ['Ana', 'Central', 1, 1, 0, 1, 5],
      ['Luis', 'Invitado', 1, 1, 0, 1, 5],
      ['Zoe', 'Central', 2, 2, 1, 3, 14],
      ['TOTAL', '3 voluntarios', 4, 4, 1, 5, 24],
    ])
    // Sin rango cuenta también la de enero.
    expect(filasHoras(asistencias, vols, congs, PROYECTO_POR_DEFECTO, { desde: '', hasta: '' }).at(-1)).toEqual(['TOTAL', '3 voluntarios', 5, 5, 1, 6, 29])
  })

  it('por tarea', () => {
    const f = filasPorTarea(tareas, programaciones, asistencias, PROYECTO_POR_DEFECTO, rango)
    expect(f.slice(1)).toEqual([
      ['Aseo', 'Pendiente', '', 2, 1, 1, 5],
      ['Pintura', 'En curso', 4, 2, 3, 2, 14],
      ['Sin tarea', '', '', 0, 1, 1, 5],
      ['TOTAL', '', '', 4, 5, 3, 24],
    ])
  })

  it('por fecha', () => {
    const f = filasPorFecha([{ fecha: '2026-12-05', cupoM: 2, cupoT: null, cuposTarea: {}, notas: '' }], programaciones, asistencias, rango)
    expect(f.slice(1)).toEqual([
      ['05/12/2026', 'Sábado', 'Mañana', 2, 1, 1, 0, 1, 2, 0, 1],
      ['05/12/2026', 'Sábado', 'Tarde', 'sin cupo', 1, 0, 1, 0, 1, 0, 0],
      ['12/12/2026', 'Sábado', 'Mañana', 'sin cupo', 2, 0, 2, 0, 2, 1, 1],
      ['TOTAL', '', '', 2, 4, 1, 3, 1, 5, 1, 2],
    ])
  })

  it('detalle de asistencia y nombre de archivo', () => {
    const f = filasDetalleAsistencia(asistencias, programaciones, vols, tareas, rango)
    expect(f).toHaveLength(7)
    expect(f[1]).toEqual(['05/12/2026', 'Mañana', 'Ana', 'Sí', '7:00 a. m.', '', '', 'No programado', ''])
    expect(nombreArchivoExport('horas', '2026-12-31')).toBe('voluntarios-horas-2026-12-31.xlsx')
  })
})
