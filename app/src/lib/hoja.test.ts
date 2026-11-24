import { PROYECTO_POR_DEFECTO } from '../db/db'
import { hojaProgramacion, nombreArchivoHoja } from './hoja'

describe('hoja imprimible', () => {
  it('encabezado, jornadas, grupos por tarea y celulares', () => {
    const h = hojaProgramacion({
      proyecto: { ...PROYECTO_POR_DEFECTO, nombre: 'Remodelación', direccion: 'Calle 1', superintendenteNombre: 'Luis', superintendenteCelular: '3001234567' },
      fecha: '2026-12-05',
      dia: { fecha: '2026-12-05', cupoM: 3, cupoT: null, cuposTarea: {}, notas: '' },
      jornadas: ['M', 'T'],
      programaciones: [
        { jornada: 'M', voluntarioId: 1, tareaId: 1, confirmacion: 'confirmado' },
        { jornada: 'M', voluntarioId: 2, tareaId: 1, confirmacion: 'no_puede' },
        { jornada: 'T', voluntarioId: 2, tareaId: null, confirmacion: 'pendiente' },
      ],
      voluntarios: new Map([
        [1, { nombre: 'José', celulares: [{ numero: '3001112233', principal: true }] }],
        [2, { nombre: 'Ana', celulares: [] }],
      ]),
      tareas: [{ id: 1, nombre: 'Pintura' }],
    })
    expect(h).toMatchObject({ proyecto: 'Remodelación', fecha: 'sábado 05/12/2026', direccion: 'Calle 1', encargado: 'Luis · 300 123 4567' })
    expect(h.jornadas[0]).toMatchObject({ titulo: 'Mañana', total: 1, cupo: 3, grupos: [{ tarea: 'Pintura', personas: [{ nombre: 'José', celular: '300 111 2233', confirmado: true }] }] })
    expect(h.jornadas[1]).toMatchObject({ titulo: 'Tarde', total: 1, cupo: null, grupos: [{ tarea: 'Sin tarea asignada' }] })
    expect(nombreArchivoHoja('2026-12-05', 'pdf')).toBe('programacion-2026-12-05.pdf')
  })
})
