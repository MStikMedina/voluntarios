// Panel de inicio (PLAN.md §2.10): asistencia de hoy y próximos 7 días.
import type { Dia, Jornada, Programacion } from '../db/tipos'
import { diaSemana, sumarDias } from './fechas'
import { resumenJornada } from './programacion'

export interface JornadaPanel {
  cupo: number | null
  programados: number
  confirmados: number
  faltan: number | null // cupo - programados (negativo = sobre el cupo)
}

export interface DiaPanel {
  fecha: string
  esTrabajo: boolean
  M: JornadaPanel
  T: JornadaPanel
}

function jornadaPanel(progs: Programacion[], j: Jornada, dia: Dia | undefined): JornadaPanel {
  const r = resumenJornada(progs, j, dia, [])
  return { cupo: r.cupo, programados: r.programados, confirmados: r.confirmados, faltan: r.faltan }
}

/**
 * Los próximos `n` días desde hoy (incluido). Se muestran los días de trabajo y cualquier
 * otro día que ya tenga cupo o programados.
 */
export function proximosDias(
  hoy: string,
  diasTrabajo: number[],
  dias: Dia[],
  progs: Programacion[],
  n = 7,
): DiaPanel[] {
  const res: DiaPanel[] = []
  for (let i = 0; i < n; i++) {
    const fecha = sumarDias(hoy, i)
    const dia = dias.find((d) => d.fecha === fecha)
    const p = progs.filter((x) => x.fecha === fecha)
    const esTrabajo = diasTrabajo.includes(diaSemana(fecha))
    const tieneAlgo = p.length > 0 || dia?.cupoM != null || dia?.cupoT != null
    if (!esTrabajo && !tieneAlgo) continue
    res.push({ fecha, esTrabajo, M: jornadaPanel(p, 'M', dia), T: jornadaPanel(p, 'T', dia) })
  }
  return res
}

/** ¿Hay algo que atender en la jornada? (sin cupo o faltan personas) */
export function estadoJornada(j: JornadaPanel): 'sin_cupo' | 'faltan' | 'completo' | 'excedido' {
  if (j.cupo === null) return 'sin_cupo'
  if (j.faltan! > 0) return 'faltan'
  if (j.faltan! < 0) return 'excedido'
  return 'completo'
}
