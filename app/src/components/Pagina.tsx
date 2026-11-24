import type { ReactNode } from 'react'

// Encabezado común de cada pantalla.
export default function Pagina({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 mb-4 bg-slate-50/95 px-4 pb-3 pt-4 backdrop-blur dark:bg-slate-950/95">
        <h1 className="text-2xl font-bold text-primario-700 dark:text-primario-200">{titulo}</h1>
      </header>
      {children}
    </>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
      {texto}
    </div>
  )
}
