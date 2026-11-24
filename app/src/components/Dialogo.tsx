import { useEffect, useRef, type ReactNode } from 'react'

// Diálogo modal sencillo (confirmaciones). Usa <dialog> nativo: Esc y el fondo lo cierran.
export default function Dialogo({
  abierto,
  titulo,
  children,
  onCerrar,
  acciones,
}: {
  abierto: boolean
  titulo: string
  children?: ReactNode
  onCerrar: () => void
  acciones: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-black/50 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="p-5">
        <h2 className="mb-2 text-lg font-semibold">{titulo}</h2>
        <div className="text-slate-600 dark:text-slate-300">{children}</div>
        <div className="mt-5 flex justify-end gap-2">{acciones}</div>
      </div>
    </dialog>
  )
}

export const claseBotonPrimario =
  'rounded-lg bg-primario-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-primario-700 disabled:opacity-40'
export const claseBotonSecundario =
  'rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium active:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:active:bg-slate-800'
export const claseBotonPeligro =
  'rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-40'
