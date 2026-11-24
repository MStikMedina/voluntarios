// Entregar un archivo al usuario: en Android con el menú de compartir (si existe),
// y si no, como descarga normal. Se usa para respaldos, Excel, imágenes y PDF.

export type ResultadoEntrega = 'compartido' | 'descargado' | 'cancelado'

/** ¿El navegador puede compartir archivos (Web Share API nivel 2)? */
export function puedeCompartirArchivos(archivo?: File): boolean {
  const n = globalThis.navigator as Navigator | undefined
  if (!n?.share || !n.canShare) return false
  try {
    return n.canShare({ files: [archivo ?? new File([''], 'prueba.txt', { type: 'text/plain' })] })
  } catch {
    return false
  }
}

export function descargarBlob(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/**
 * Comparte el archivo si se puede (y `compartir` no es false); si no, lo descarga.
 * Si el usuario cierra el menú de compartir devuelve 'cancelado'.
 */
export async function entregarArchivo(
  blob: Blob,
  nombre: string,
  opciones: { compartir?: boolean; titulo?: string; texto?: string } = {},
): Promise<ResultadoEntrega> {
  const archivo = new File([blob], nombre, { type: blob.type || 'application/octet-stream' })
  if (opciones.compartir !== false && puedeCompartirArchivos(archivo)) {
    try {
      await navigator.share({ files: [archivo], title: opciones.titulo ?? nombre, text: opciones.texto })
      return 'compartido'
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelado'
      // Algunos navegadores fallan al compartir ciertos tipos: se descarga.
    }
  }
  descargarBlob(blob, nombre)
  return 'descargado'
}

/** Comparte solo texto (WhatsApp, etc.). Devuelve false si no hay menú de compartir. */
export async function compartirTexto(texto: string, titulo?: string): Promise<boolean> {
  const n = globalThis.navigator as Navigator | undefined
  if (!n?.share) return false
  try {
    await n.share({ text: texto, title: titulo })
    return true
  } catch {
    return true // cancelado por el usuario: no es un error
  }
}

/** Copia texto al portapapeles. */
export async function copiarTexto(texto: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto)
    return true
  } catch {
    return false
  }
}
