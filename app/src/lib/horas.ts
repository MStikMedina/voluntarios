import type { Jornadas, Turno } from '../db/tipos'
import { aMinutos } from './fechas'

/** Horas de una jornada según el horario configurado (D = mañana + tarde). */
export function horasDeJornada(turno: Turno, jornadas: Jornadas): number {
  if (turno === 'D') return horasDeJornada('M', jornadas) + horasDeJornada('T', jornadas)
  const { inicio, fin } = jornadas[turno]
  const a = aMinutos(inicio)
  const b = aMinutos(fin)
  if (a === null || b === null || b <= a) return 0
  return (b - a) / 60
}
