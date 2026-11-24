import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import BarraInferior from './BarraInferior'
import AvisoActualizacion from './AvisoActualizacion'

export default function Layout() {
  return (
    <div className="min-h-full pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <main className="mx-auto max-w-xl px-4 pt-[env(safe-area-inset-top)]">
        <Suspense fallback={<p className="pt-6 text-center text-slate-500">Cargando…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <AvisoActualizacion />
      <BarraInferior />
    </div>
  )
}
