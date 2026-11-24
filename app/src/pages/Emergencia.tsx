import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import TelefonoAcciones from '../components/TelefonoAcciones'
import { claseInput } from '../components/Campos'
import { IconoBuscar } from '../components/Iconos'
import { ordenarVoluntarios } from '../lib/voluntarios'
import { coincide } from '../lib/texto'

const ORIGENES: Record<string, string> = { '/': 'Inicio', '/asistencia': 'Asistencia' }

// Acceso de emergencia: se escribe el nombre y se llama al contacto de emergencia.
// Si el voluntario no tiene contacto, se ofrece el coordinador de su congregación.
export default function Emergencia() {
  const desde = (useLocation().state as { desde?: string } | null)?.desde
  const volver = desde && ORIGENES[desde] ? { to: desde, texto: ORIGENES[desde] } : { to: '/', texto: 'Inicio' }
  const [busqueda, setBusqueda] = useState('')

  const datos = useLiveQuery(async () => {
    const [voluntarios, congregaciones] = await Promise.all([db.voluntarios.toArray(), db.congregaciones.toArray()])
    return { voluntarios: ordenarVoluntarios(voluntarios), congregaciones: new Map(congregaciones.map((c) => [c.id, c])) }
  })

  const resultados = datos?.voluntarios.filter((v) => coincide(busqueda, v.nombre)) ?? []

  return (
    <Pagina titulo="Emergencia" volver={volver}>
      <label className="relative mb-4 block">
        <span className="sr-only">Nombre del voluntario</span>
        <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          autoFocus
          enterKeyHint="search"
          autoComplete="off"
          placeholder="Nombre del voluntario…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={`${claseInput} pl-10 text-lg`}
        />
      </label>

      {!datos ? (
        <p className="text-slate-500">Cargando…</p>
      ) : resultados.length === 0 ? (
        <p className="text-center text-slate-500 dark:text-slate-400">
          {datos.voluntarios.length === 0 ? 'Aún no hay voluntarios.' : 'Nadie coincide con ese nombre.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {resultados.map((v) => {
            const cong = v.congregacionId != null ? datos.congregaciones.get(v.congregacionId) : undefined
            return (
              <li key={v.id} className="rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
                <Link to={`/voluntarios/${v.id}`} className="mb-2 block">
                  <p className="font-semibold">{v.nombre}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {cong?.nombre ?? (v.invitado ? 'Invitado' : 'Sin congregación')}
                  </p>
                </Link>
                {v.emergenciaCelular ? (
                  <TelefonoAcciones
                    numero={v.emergenciaCelular}
                    etiqueta={`Emergencia: ${v.emergenciaNombre || 'contacto sin nombre'}`}
                  />
                ) : (
                  <>
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                      ⚠ No tiene contacto de emergencia registrado.
                    </p>
                    {cong?.coordinadorCelular && (
                      <div className="mt-2">
                        <TelefonoAcciones
                          numero={cong.coordinadorCelular}
                          etiqueta={`Coordinador: ${cong.coordinadorNombre || cong.nombre}`}
                        />
                      </div>
                    )}
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Pagina>
  )
}
