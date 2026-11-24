import { Link, useLocation } from 'react-router-dom'
import { IconoEmergencia } from './Iconos'

// Acceso de emergencia (PLAN.md §2.6): toque 1 abre la búsqueda, toque 2 llama al contacto.
// Está en Inicio y en Asistencia.
export default function BotonEmergencia() {
  const { pathname } = useLocation()
  return (
    <Link
      to="/emergencia"
      state={{ desde: pathname }}
      className="mb-4 flex items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-white shadow-sm active:bg-red-700"
    >
      <IconoEmergencia className="h-7 w-7 shrink-0" />
      <span>
        <span className="block font-semibold">Emergencia</span>
        <span className="block text-sm text-red-100">Buscar a un voluntario y llamar a su contacto</span>
      </span>
    </Link>
  )
}
