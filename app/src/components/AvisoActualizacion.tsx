import { useRegisterSW } from 'virtual:pwa-register/react'

// Aviso de "Nueva versión disponible" (registerType: 'prompt').
export default function AvisoActualizacion() {
  const {
    needRefresh: [hayNueva, setHayNueva],
    offlineReady: [listoSinInternet, setListoSinInternet],
    updateServiceWorker,
  } = useRegisterSW()

  if (!hayNueva && !listoSinInternet) return null

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
      <span className="flex-1">
        {hayNueva ? 'Hay una nueva versión disponible.' : 'La app ya funciona sin internet.'}
      </span>
      {hayNueva && (
        <button
          className="rounded-lg bg-primario-500 px-3 py-1.5 font-semibold text-white"
          onClick={() => updateServiceWorker(true)}
        >
          Recargar
        </button>
      )}
      <button
        className="px-1 font-semibold opacity-70"
        onClick={() => {
          setHayNueva(false)
          setListoSinInternet(false)
        }}
        aria-label="Cerrar aviso"
      >
        ✕
      </button>
    </div>
  )
}
