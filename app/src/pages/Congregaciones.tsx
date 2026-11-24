import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina, { Vacio } from '../components/Pagina'
import TelefonoAcciones from '../components/TelefonoAcciones'
import { IconoFlecha, IconoMasSimbolo } from '../components/Iconos'
import { ordenarCongregaciones } from '../lib/congregaciones'

export default function Congregaciones() {
  const datos = useLiveQuery(async () => {
    const [congregaciones, voluntarios] = await Promise.all([
      db.congregaciones.toArray(),
      db.voluntarios.toArray(),
    ])
    const cuenta = new Map<number, number>()
    for (const v of voluntarios) {
      if (v.congregacionId != null) cuenta.set(v.congregacionId, (cuenta.get(v.congregacionId) ?? 0) + 1)
    }
    return ordenarCongregaciones(congregaciones).map((c) => ({ ...c, voluntarios: cuenta.get(c.id) ?? 0 }))
  })

  return (
    <Pagina titulo="Congregaciones" volver={{ to: '/mas', texto: 'Más' }}>
      <Link
        to="/mas/congregaciones/nueva"
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Nueva congregación
      </Link>

      {!datos ? (
        <p className="text-slate-500">Cargando…</p>
      ) : datos.length === 0 ? (
        <Vacio texto="Aún no hay congregaciones. Agregue las congregaciones que participan en el proyecto." />
      ) : (
        <ul className="space-y-3">
          {datos.map((c) => (
            <li key={c.id} className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
              <Link
                to={`/mas/congregaciones/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.nombre}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {c.numero ? `N.º ${c.numero} · ` : ''}
                    {c.voluntarios === 1 ? '1 voluntario' : `${c.voluntarios} voluntarios`}
                  </p>
                </div>
                <IconoFlecha className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
              {(c.coordinadorCelular || c.otroContactoCelular) && (
                <div className="space-y-3 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                  <TelefonoAcciones
                    numero={c.coordinadorCelular}
                    etiqueta={`Coordinador${c.coordinadorNombre ? `: ${c.coordinadorNombre}` : ''}`}
                  />
                  <TelefonoAcciones
                    numero={c.otroContactoCelular}
                    etiqueta={`Otro contacto${c.otroContactoNombre ? `: ${c.otroContactoNombre}` : ''}`}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}
