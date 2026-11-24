// Convierte un elemento de la página en PNG o PDF (carga las librerías solo cuando se usan).

export async function elementoAPng(el: HTMLElement): Promise<Blob> {
  const { toBlob } = await import('html-to-image')
  const blob = await toBlob(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  if (!blob) throw new Error('No se pudo generar la imagen.')
  return blob
}

/**
 * PDF tamaño carta; si la hoja es más alta que una página, se reparte en varias y los cortes
 * caen en el borde superior de algún elemento marcado con `data-corte` (filas, títulos).
 */
export async function elementoAPdf(el: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')])
  const canvas = await toCanvas(el, { pixelRatio: 2, backgroundColor: '#ffffff', cacheBust: true })
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const margen = 10
  const anchoPag = pdf.internal.pageSize.getWidth() - margen * 2
  const altoPag = pdf.internal.pageSize.getHeight() - margen * 2
  const escala = anchoPag / canvas.width // mm por píxel
  const altoPxPorPagina = Math.floor(altoPag / escala)
  const proporcion = canvas.height / el.getBoundingClientRect().height
  const arriba = el.getBoundingClientRect().top
  const cortes = [...el.querySelectorAll<HTMLElement>('[data-corte]')]
    .map((x) => Math.round((x.getBoundingClientRect().top - arriba) * proporcion))
    .filter((c) => c > 0)
  let y = 0
  let primera = true
  while (y < canvas.height) {
    let alto = Math.min(altoPxPorPagina, canvas.height - y)
    if (y + alto < canvas.height) {
      const corte = cortes.filter((c) => c > y + altoPxPorPagina * 0.5 && c <= y + alto).pop()
      if (corte) alto = corte - y
    }
    const trozo = document.createElement('canvas')
    trozo.width = canvas.width
    trozo.height = alto
    trozo.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, alto, 0, 0, canvas.width, alto)
    if (!primera) pdf.addPage()
    pdf.addImage(trozo.toDataURL('image/jpeg', 0.92), 'JPEG', margen, margen, anchoPag, alto * escala)
    primera = false
    y += alto
  }
  return pdf.output('blob')
}
