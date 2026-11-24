import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { EstadoTarea } from '../db/tipos'
import Pagina, { Vacio } from '../components/Pagina'
import Opciones from '../components/Opciones'
import { IconoFlecha, IconoMasSimbolo } from '../components/Iconos'
import { formatoFecha } from '../lib/fechas'
import { ESTADOS, ordenarTareas } from '../lib/tareas'
import InsigniaEstado from '../components/InsigniaEstado'

export default function Tareas() {
  const [filtro, setFiltro] = useState<'' | EstadoTarea>('')
  const datos = useLiveQuery(async () => {
    const [tareas, voluntarios] = await Promise.all([db.tareas.toArray(), db.voluntarios.toArray()])
    const habituales = new Map<number, number>()
    for (const v of voluntarios) {
      if (v.tareaHabitualId != null) habituales.set(v.tareaHabitualId, (habituales.get(v.tareaHabitualId) ?? 0) + 1)
    }
    return ordenarTareas(tareas).map((t) => ({ ...t, habituales: habituales.get(t.id) ?? 0 }))
  })
  const visibles = datos?.filter((t) => !filtro || t.estado === filtro) ?? []

  return (
    <Pagina titulo="Tareas" volver={{ to: '/mas', texto: 'Más' }}>
      <Link
        to="/mas/tareas/nueva"
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Nueva tarea
      </Link>

      {datos && datos.length > 0 && (
        <div className="mb-3">
          <Opciones<'' | EstadoTarea>
            valor={filtro}
            onCambiar={setFiltro}
            etiqueta="Filtrar por estado"
            opciones={[{ valor: '', texto: `Todas (${datos.length})` }, ...ESTADOS.map((e) => ({
              valor: e.valor,
              texto: `${e.texto} (${datos.filter((t) => t.estado === e.valor).length})`,
            }))]}
          />
        </div>
      )}

      {!datos ? (
        <p className="text-slate-500">Cargando…</p>
      ) : datos.length === 0 ? (
        <Vacio texto="Aún no hay tareas. Cree los frentes de trabajo (pintura, electricidad, aseo…)." />
      ) : visibles.length === 0 ? (
        <Vacio texto="No hay tareas con ese estado." />
      ) : (
        <ul className="space-y-2">
          {visibles.map((t) => (
            <li key={t.id}>
              <Link
                to={`/mas/tareas/${t.id}`}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm active:bg-slate-100 dark:bg-slate-900 dark:active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{t.nombre}</p>
                    <InsigniaEstado estado={t.estado} />
                  </div>
                  <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                    {[
                      t.personasNecesarias ? `${t.personasNecesarias} personas` : '',
                      t.habilidadRequerida,
                      t.fechaInicio || t.fechaFin
                        ? `${formatoFecha(t.fechaInicio) || '…'} → ${formatoFecha(t.fechaFin) || '…'}`
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'Sin detalles'}
                  </p>
                  {t.habituales > 0 && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Tarea habitual de {t.habituales} voluntario{t.habituales === 1 ? '' : 's'}
                    </p>
                  )}
                </div>
                <IconoFlecha className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}
