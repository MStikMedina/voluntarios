import { estadoJornada, proximosDias } from './panel'
import type { Programacion } from '../db/tipos'

const p = (fecha: string, jornada: 'M' | 'T', confirmacion: Programacion['confirmacion'] = 'pendiente') =>
  ({ id: 0, fecha, jornada, voluntarioId: 1, confirmacion, mensajeEnviado: false }) as Programacion

describe('panel de inicio', () => {
  it('próximos 7 días: días de trabajo y días con algo', () => {
    // lunes 23/11/2026; trabajo los sábados
    const r = proximosDias('2026-11-23', [6], [{ fecha: '2026-11-28', cupoM: 3, cupoT: null, cuposTarea: {}, notas: '' }], [
      p('2026-11-28', 'M'), p('2026-11-28', 'M', 'confirmado'), p('2026-11-28', 'M', 'no_puede'), p('2026-11-25', 'T'), p('2026-12-05', 'M'),
    ])
    expect(r.map((d) => d.fecha)).toEqual(['2026-11-25', '2026-11-28'])
    expect(r[0]).toMatchObject({ esTrabajo: false, T: { cupo: null, programados: 1 } })
    expect(r[1].M).toEqual({ cupo: 3, programados: 2, confirmados: 1, faltan: 1 })
    expect(r[1].T).toEqual({ cupo: null, programados: 0, confirmados: 0, faltan: null })
  })

  it('estado de la jornada', () => {
    expect(estadoJornada({ cupo: null, programados: 0, confirmados: 0, faltan: null })).toBe('sin_cupo')
    expect(estadoJornada({ cupo: 3, programados: 1, confirmados: 0, faltan: 2 })).toBe('faltan')
    expect(estadoJornada({ cupo: 3, programados: 3, confirmados: 0, faltan: 0 })).toBe('completo')
    expect(estadoJornada({ cupo: 3, programados: 4, confirmados: 0, faltan: -1 })).toBe('excedido')
  })
})
