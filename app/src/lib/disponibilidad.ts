import type { Disponibilidad, Jornada, Turno } from '../db/tipos'
import { diaSemana } from './fechas'

/** Códigos cortos por día; el índice es el día de la semana (0 = domingo). */
export const CODIGOS_DIA = ['DO', 'LU', 'MA', 'MI', 'JU', 'VI', 'SA'] as const
/** Orden de la semana para mostrar (lunes primero). */
export const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0] as const

export function disponibilidadVacia(): Disponibilidad {
  return [null, null, null, null, null, null, null]
}

/** ¿El turno del día cubre la jornada? D cubre M y T. */
export function turnoCubre(turno: Turno | null | undefined, jornada: Jornada): boolean {
  return turno === 'D' || turno === jornada
}

export function disponibleEn(
  vol: { disponibilidad: Disponibilidad },
  fecha: string,
  jornada: Jornada,
): boolean {
  return turnoCubre(vol.disponibilidad?.[diaSemana(fecha)], jornada)
}

function combinar(a: Turno | null, b: Turno): Turno {
  if (!a || a === b) return b
  return 'D' // M + T (o cualquier cosa con D) = día completo
}

/**
 * 'LU-M, MA-T, SA-D' → disponibilidad. Acepta separadores , ; y espacio,
 * minúsculas y tildes. Devuelve también los códigos que no entendió.
 */
export function parsearCodigosDisponibilidad(texto: string | null | undefined): {
  disponibilidad: Disponibilidad
  errores: string[]
} {
  const disponibilidad = disponibilidadVacia()
  const errores: string[] = []
  const partes = (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/[,;\s]+/)
    .filter(Boolean)
  for (const parte of partes) {
    const m = parte.match(/^([A-Z]{2})[-_:/]?([MTD])$/)
    const dia = m ? (CODIGOS_DIA as readonly string[]).indexOf(m[1]) : -1
    if (!m || dia < 0) {
      errores.push(parte)
      continue
    }
    disponibilidad[dia] = combinar(disponibilidad[dia], m[2] as Turno)
  }
  return { disponibilidad, errores }
}

/** Inversa: disponibilidad → 'LU-M, MA-T, SA-D' (lunes primero). */
export function codigosDisponibilidad(disp: Disponibilidad | null | undefined): string {
  if (!disp) return ''
  return ORDEN_SEMANA.filter((d) => disp[d])
    .map((d) => `${CODIGOS_DIA[d]}-${disp[d]}`)
    .join(', ')
}
