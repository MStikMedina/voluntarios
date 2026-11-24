import { formatoCelular, telHref, validarCelular } from '../lib/telefono'
import { esAndroid, whatsappHref } from '../lib/whatsapp'
import { IconoTelefono, IconoWhatsapp } from './Iconos'

// Botones de Llamar y WhatsApp para un celular. Se usa en TODOS los lugares donde aparece
// un celular (PLAN.md §2.5). En Android, WhatsApp abre siempre el normal (com.whatsapp).
export default function TelefonoAcciones({
  numero,
  etiqueta,
  texto = '',
  compacto = false,
}: {
  numero: string | null | undefined
  /** Nombre de la persona o rol (se muestra encima del número y en las etiquetas accesibles). */
  etiqueta?: string
  /** Mensaje inicial para WhatsApp. */
  texto?: string
  /** Solo los dos botones redondos, sin el número. */
  compacto?: boolean
}) {
  if (!numero?.trim()) return null
  const valido = validarCelular(numero)
  const quien = etiqueta ? ` a ${etiqueta}` : ''
  const android = esAndroid()

  const botones = valido && (
    <div className="flex shrink-0 gap-2">
      <a
        href={telHref(numero)}
        aria-label={`Llamar${quien}`}
        title="Llamar"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-primario-600 text-white active:bg-primario-700"
      >
        <IconoTelefono className="h-5 w-5" />
      </a>
      <a
        href={whatsappHref(numero, texto, android)}
        // En el PC wa.me se abre en otra pestaña; en Android el intent abre la app.
        target={android ? undefined : '_blank'}
        rel="noopener noreferrer"
        aria-label={`WhatsApp${quien}`}
        title="WhatsApp"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-green-600 text-white active:bg-green-700"
      >
        <IconoWhatsapp className="h-5 w-5" />
      </a>
    </div>
  )

  if (compacto) return botones || null

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        {etiqueta && <p className="truncate text-sm text-slate-500 dark:text-slate-400">{etiqueta}</p>}
        <p className="font-medium tabular-nums">
          {formatoCelular(numero)}
          {!valido && <span className="ml-2 text-xs font-normal text-red-600 dark:text-red-400">(número no válido)</span>}
        </p>
      </div>
      {botones}
    </div>
  )
}
