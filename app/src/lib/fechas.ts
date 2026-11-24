// Fechas como texto 'YYYY-MM-DD' (hora local, sin desfases de zona horaria)
// y horas como 'HH:MM' (24 h). Se muestran como dd/mm/aaaa y 12 h.

const dos = (n: number) => String(n).padStart(2, '0')

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

export function deISO(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d)
}

export function hoyISO(): string {
  return aISO(new Date())
}

export function esFechaISO(iso: string | null | undefined): iso is string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  return aISO(deISO(iso)) === iso
}

/** 'YYYY-MM-DD' → 'dd/mm/aaaa' */
export function formatoFecha(iso: string | null | undefined): string {
  if (!esFechaISO(iso)) return ''
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** 'dd/mm/aaaa' (acepta d/m/aaaa y separadores / - .) → 'YYYY-MM-DD' o null si no es válida. */
export function parsearFecha(texto: string | null | undefined): string | null {
  const m = (texto ?? '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!m) return null
  const iso = `${m[3]}-${dos(Number(m[2]))}-${dos(Number(m[1]))}`
  return esFechaISO(iso) ? iso : null
}

export function sumarDias(iso: string, n: number): string {
  const d = deISO(iso)
  d.setDate(d.getDate() + n)
  return aISO(d)
}

/** 0 = domingo … 6 = sábado */
export function diaSemana(iso: string): number {
  return deISO(iso).getDay()
}

export const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** 'lunes 24/11/2026' */
export function fechaLarga(iso: string): string {
  return `${NOMBRES_DIA[diaSemana(iso)].toLowerCase()} ${formatoFecha(iso)}`
}

/** Edad en años cumplidos a la fecha `hoy`. */
export function edad(fechaNac: string | null | undefined, hoy: string = hoyISO()): number | null {
  if (!esFechaISO(fechaNac)) return null
  const [a1, m1, d1] = fechaNac.split('-').map(Number)
  const [a2, m2, d2] = hoy.split('-').map(Number)
  let e = a2 - a1
  if (m2 < m1 || (m2 === m1 && d2 < d1)) e--
  return e
}

export type AlertaEdad = 'menor' | 'mayor' | null

/** 'menor' si edad < edadMenor; 'mayor' si edad > edadMayor. */
export function alertaEdad(
  e: number | null,
  limites: { edadMenor: number; edadMayor: number },
): AlertaEdad {
  if (e === null) return null
  if (e < limites.edadMenor) return 'menor'
  if (e > limites.edadMayor) return 'mayor'
  return null
}

/** 'HH:MM' (24 h) → '7:00 a. m.' */
export function formatoHora(hhmm: string | null | undefined): string {
  const min = aMinutos(hhmm)
  if (min === null) return ''
  const h = Math.floor(min / 60)
  const sufijo = h < 12 ? 'a. m.' : 'p. m.'
  return `${h % 12 === 0 ? 12 : h % 12}:${dos(min % 60)} ${sufijo}`
}

export function horaActual(d: Date = new Date()): string {
  return `${dos(d.getHours())}:${dos(d.getMinutes())}`
}

/** 'HH:MM' → minutos desde la medianoche, o null. */
export function aMinutos(hhmm: string | null | undefined): number | null {
  const m = (hhmm ?? '').match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

/** Fecha-hora ISO → 'dd/mm/aaaa h:mm a. m.' ('—' si no hay). */
export function fechaHora(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${formatoFecha(aISO(d))} ${formatoHora(horaActual(d))}`
}
