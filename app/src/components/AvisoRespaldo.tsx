import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { respaldoPendiente } from '../lib/respaldo'
import { fechaHora } from '../lib/fechas'

// Recordatorio de respaldo (PLAN.md §2.13): aparece si hubo cambios después del último
// respaldo y ya pasó un día (o una semana, según Ajustes).
export default function AvisoRespaldo() {
  const proyecto = useLiveQuery(() => db.obtenerProyecto())
  if (!proyecto || !respaldoPendiente(proyecto)) return null
  return (
    <Link
      to="/mas/respaldo"
      className="mb-4 block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 active:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100"
    >
      <span className="block font-semibold">💾 Haga un respaldo</span>
      <span className="block text-sm">
        Hay cambios sin respaldar. Último respaldo: {proyecto.ultimoRespaldo ? fechaHora(proyecto.ultimoRespaldo) : 'nunca'}.
        Toque aquí.
      </span>
    </Link>
  )
}
