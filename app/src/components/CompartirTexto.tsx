import { useState } from 'react'
import Dialogo, { claseBotonSecundario } from './Dialogo'
import { IconoWhatsapp } from './Iconos'
import { compartirTexto, copiarTexto } from '../lib/descargas'
import { esAndroid, whatsappTextoHref } from '../lib/whatsapp'

// Muestra un texto ya formateado para WhatsApp y permite enviarlo, compartirlo o copiarlo.
export default function CompartirTexto({
  titulo,
  texto,
  onCerrar,
  opciones,
}: {
  titulo: string
  texto: string
  onCerrar: () => void
  opciones?: React.ReactNode
}) {
  const [copiado, setCopiado] = useState(false)
  const android = esAndroid()
  const puedeCompartir = typeof navigator !== 'undefined' && !!navigator.share
  return (
    <Dialogo
      abierto
      titulo={titulo}
      onCerrar={onCerrar}
      acciones={
        <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
          Cerrar
        </button>
      }
    >
      {opciones}
      <pre className="mb-3 max-h-[45vh] overflow-y-auto whitespace-pre-wrap rounded-lg bg-green-50 p-3 font-sans text-sm text-slate-800 dark:bg-green-950/40 dark:text-slate-100">
        {texto}
      </pre>
      <div className="grid gap-2">
        <a
          href={whatsappTextoHref(texto, android)}
          target={android ? undefined : '_blank'}
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white active:bg-green-700"
        >
          <IconoWhatsapp className="h-5 w-5" /> Enviar por WhatsApp
        </a>
        <div className="grid grid-cols-2 gap-2">
          {puedeCompartir && (
            <button type="button" onClick={() => compartirTexto(texto)} className={claseBotonSecundario}>
              Compartir…
            </button>
          )}
          <button
            type="button"
            onClick={async () => setCopiado(await copiarTexto(texto))}
            className={`${claseBotonSecundario} ${puedeCompartir ? '' : 'col-span-2'}`}
          >
            {copiado ? '✓ Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
    </Dialogo>
  )
}
