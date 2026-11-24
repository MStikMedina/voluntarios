import type { InputHTMLAttributes, ReactNode } from 'react'

// Piezas de formulario reutilizables (Ajustes, Congregaciones, Voluntarios…).

export const claseInput =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-primario-500 focus:ring-2 focus:ring-primario-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-primario-800 [color-scheme:light] dark:[color-scheme:dark]'

const claseError = 'border-red-500 dark:border-red-500'

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="mb-3 font-semibold text-primario-700 dark:text-primario-200">{titulo}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

export function MensajeError({ texto }: { texto?: string }) {
  if (!texto) return null
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{texto}</p>
}

export function Campo({
  etiqueta,
  error,
  ayuda,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; error?: string; ayuda?: ReactNode }) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">{etiqueta}</span>
      <input {...props} aria-invalid={!!error} className={`${claseInput} ${error ? claseError : ''}`} />
      {ayuda && !error && <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{ayuda}</span>}
      <MensajeError texto={error} />
    </label>
  )
}

/** Aviso amarillo que no bloquea (p. ej. posibles duplicados). */
export function Aviso({ children, final = 'Puede guardar de todos modos.' }: { children: ReactNode; final?: string }) {
  return (
    <p className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      ⚠ {children}
      {final && ` ${final}`}
    </p>
  )
}
