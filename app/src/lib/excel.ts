// Excel con SheetJS. Se carga solo cuando se necesita (import dinámico) para que la app abra rápido.

export type Celda = string | number | boolean | Date | null | undefined

export interface Hoja {
  nombre: string
  filas: Celda[][]
  /** Ancho de cada columna en caracteres. */
  anchos?: number[]
}

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const cargar = () => import('xlsx')

/** Crea un libro .xlsx con varias hojas y lo devuelve como Blob. */
export async function libroABlob(hojas: Hoja[]): Promise<Blob> {
  const XLSX = await cargar()
  const libro = XLSX.utils.book_new()
  for (const h of hojas) {
    const hoja = XLSX.utils.aoa_to_sheet(h.filas)
    const anchos =
      h.anchos ??
      (h.filas[0] ?? []).map((_, i) =>
        Math.min(50, Math.max(8, ...h.filas.slice(0, 200).map((f) => String(f[i] ?? '').length + 2))),
      )
    hoja['!cols'] = anchos.map((wch) => ({ wch }))
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.slice(0, 31))
  }
  const datos = XLSX.write(libro, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return new Blob([datos], { type: MIME_XLSX })
}

/** Lee la primera hoja de un Excel (o CSV) como filas de texto. Las fechas salen como 'YYYY-MM-DD'. */
export async function leerPrimeraHoja(datos: ArrayBuffer): Promise<string[][]> {
  const XLSX = await cargar()
  const libro = XLSX.read(datos, { type: 'array', cellDates: true })
  const nombre = libro.SheetNames[0]
  if (!nombre) return []
  const filas = XLSX.utils.sheet_to_json<Celda[]>(libro.Sheets[nombre], { header: 1, raw: true, defval: '' })
  return filas.map((f) => f.map(celdaATexto))
}

const dos = (n: number) => String(n).padStart(2, '0')

export function celdaATexto(c: Celda): string {
  if (c === null || c === undefined) return ''
  if (c instanceof Date) {
    // SheetJS crea las fechas en UTC a medianoche (con un posible desfase de segundos).
    const d = new Date(c.getTime() + 12 * 3600_000)
    return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())}`
  }
  if (typeof c === 'number') return Number.isInteger(c) ? String(c) : String(c)
  if (typeof c === 'boolean') return c ? 'Sí' : ''
  return String(c)
}
