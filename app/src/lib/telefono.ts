// Celulares de Colombia (+57): 10 dígitos que empiezan por 3.

/** Deja solo los dígitos y quita el indicativo 57 si viene incluido. */
export function limpiarCelular(texto: string | null | undefined): string {
  let d = (texto ?? '').replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2)
  return d
}

export function validarCelular(texto: string | null | undefined): boolean {
  return /^3\d{9}$/.test(limpiarCelular(texto))
}

/** '3001234567' → '300 123 4567' (si no es válido, lo devuelve tal cual). */
export function formatoCelular(texto: string | null | undefined): string {
  const d = limpiarCelular(texto)
  if (d.length !== 10) return (texto ?? '').trim()
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

/** Número internacional sin '+': '573001234567'. */
export function celularInternacional(texto: string | null | undefined): string {
  return `57${limpiarCelular(texto)}`
}

export function telHref(texto: string | null | undefined): string {
  return `tel:+${celularInternacional(texto)}`
}
