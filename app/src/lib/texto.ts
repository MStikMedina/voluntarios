// Normalización de texto para búsquedas: minúsculas, sin tildes y sin espacios repetidos.
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** true si TODAS las palabras de la búsqueda aparecen en alguno de los campos. */
export function coincide(busqueda: string, ...campos: (string | null | undefined)[]): boolean {
  const palabras = normalizar(busqueda).split(' ').filter(Boolean)
  if (palabras.length === 0) return true
  const texto = campos.map(normalizar).join(' ')
  return palabras.every((p) => texto.includes(p))
}
