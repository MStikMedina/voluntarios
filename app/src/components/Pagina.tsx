import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Encabezado común de cada pantalla. `volver` muestra un enlace de regreso (p. ej. a "Más").
export default function Pagina({
  titulo,
  volver,
  children,
}: {
  titulo: string
  volver?: { to: string; texto: string }
  children?: ReactNode
}) {
  return (
    <>
      <header className="sticky top-0 z-10 -mx-4 mb-4 bg-slate-50/95 px-4 pb-3 pt-4 backdrop-blur dark:bg-slate-950/95">
        {volver && (
          <Link
            to={volver.to}
            className="mb-1 inline-block text-sm font-medium text-primario-600 dark:text-primario-300"
          >
            ← {volver.texto}
          </Link>
        )}
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
