import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina, { Vacio } from '../components/Pagina'
import TelefonoAcciones from '../components/TelefonoAcciones'
import Edad from '../components/Edad'
import { IconoMasSimbolo } from '../components/Iconos'
import { celularPrincipal, ordenarVoluntarios } from '../lib/voluntarios'

// Lista alfabética. La búsqueda, los filtros y el acceso de emergencia llegan en la Fase 6.
export default function Voluntarios() {
  const datos = useLiveQuery(async () => {
    const [voluntarios, congregaciones, proyecto] = await Promise.all([
      db.voluntarios.toArray(),
      db.congregaciones.toArray(),
      db.obtenerProyecto(),
    ])
    const nombres = new Map(congregaciones.map((c) => [c.id, c.nombre]))
    return {
      lista: ordenarVoluntarios(voluntarios).map((v) => ({
        ...v,
        congregacion: v.congregacionId != null ? nombres.get(v.congregacionId) : undefined,
      })),
      limites: { edadMenor: proyecto.edadMenor, edadMayor: proyecto.edadMayor },
    }
  })

  return (
    <Pagina titulo="Voluntarios">
      <Link
        to="/voluntarios/nuevo"
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Nuevo voluntario
      </Link>

      {!datos ? (
        <p className="text-slate-500">Cargando…</p>
      ) : datos.lista.length === 0 ? (
        <Vacio texto="Aún no hay voluntarios. Toque «Nuevo voluntario» para agregar el primero." />
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            {datos.lista.length === 1 ? '1 voluntario' : `${datos.lista.length} voluntarios`}
          </p>
          <ul className="space-y-2">
            {datos.lista.map((v) => (
              <li key={v.id} className="flex items-center gap-2 rounded-xl bg-white pr-3 shadow-sm dark:bg-slate-900">
                <Link
                  to={`/voluntarios/${v.id}`}
                  className="min-w-0 flex-1 rounded-l-xl px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
                >
                  <p className="truncate font-semibold">{v.nombre}</p>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {[v.congregacion ?? (v.invitado ? 'Invitado' : 'Sin congregación'), v.profesion]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <Edad fechaNacimiento={v.fechaNacimiento} limites={datos.limites} soloAlerta />
                </Link>
                <TelefonoAcciones numero={celularPrincipal(v)} etiqueta={v.nombre} compacto />
              </li>
            ))}
          </ul>
        </>
      )}
    </Pagina>
  )
}
