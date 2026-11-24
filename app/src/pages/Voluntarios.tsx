import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina, { Vacio } from '../components/Pagina'
import TelefonoAcciones from '../components/TelefonoAcciones'
import Edad from '../components/Edad'
import Opciones from '../components/Opciones'
import { claseInput } from '../components/Campos'
import { IconoBuscar, IconoCerrar, IconoFiltro, IconoMasSimbolo } from '../components/Iconos'
import { celularPrincipal, NOMBRES_TURNO, ordenarVoluntarios } from '../lib/voluntarios'
import {
  filtrarVoluntarios, filtrosActivos, filtrosAParams, filtrosDeParams, filtrosVacios, recordarBusquedaLista,
  type FiltroJornada, type FiltrosVoluntarios,
} from '../lib/filtros'
import { ORDEN_SEMANA } from '../lib/disponibilidad'
import { NOMBRES_DIA } from '../lib/fechas'
import { normalizar } from '../lib/texto'

// Lista alfabética con búsqueda (nombre y profesión) y filtros combinables (PLAN.md §2.6).
// Los filtros viven en la URL: se conservan al abrir una ficha y volver.
export default function Voluntarios() {
  const [params, setParams] = useSearchParams()
  const busqueda = params.toString()
  useEffect(() => recordarBusquedaLista(busqueda), [busqueda])
  const filtros = filtrosDeParams(params)
  const cambiar = (c: Partial<FiltrosVoluntarios>) =>
    setParams((prev) => filtrosAParams({ ...filtrosDeParams(prev), ...c }), { replace: true })
  const nActivos = filtrosActivos(filtros)
  const [panel, setPanel] = useState(false)

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
      congregaciones: [...congregaciones].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es')),
      limites: { edadMenor: proyecto.edadMenor, edadMayor: proyecto.edadMayor },
    }
  })

  const visibles = datos ? filtrarVoluntarios(datos.lista, filtros) : []

  // Etiquetas de los filtros puestos, cada una con su botón para quitarla.
  const chips: { texto: string; quitar: Partial<FiltrosVoluntarios> }[] = []
  if (datos) {
    if (filtros.congregacion) {
      const texto =
        filtros.congregacion === 'invitados'
          ? 'Invitados'
          : filtros.congregacion === 'sin'
            ? 'Sin congregación'
            : (datos.congregaciones.find((c) => String(c.id) === filtros.congregacion)?.nombre ?? 'Congregación')
      chips.push({ texto, quitar: { congregacion: '' } })
    }
    if (filtros.tipo) chips.push({ texto: filtros.tipo, quitar: { tipo: '' } })
    if (filtros.dia !== null || filtros.jornada) {
      const dia = filtros.dia !== null ? NOMBRES_DIA[filtros.dia] : 'Algún día'
      const jornada = filtros.jornada ? ` · ${NOMBRES_TURNO[filtros.jornada]}` : ''
      chips.push({ texto: `${dia}${jornada}`, quitar: { dia: null, jornada: '' } })
    }
    if (filtros.edadMin !== null || filtros.edadMax !== null) {
      const { edadMin: a, edadMax: b } = filtros
      const texto = a !== null && b !== null ? `${a} a ${b} años` : a !== null ? `${a} años o más` : `${b} años o menos`
      chips.push({ texto, quitar: { edadMin: null, edadMax: null } })
    }
  }

  return (
    <Pagina titulo="Voluntarios">
      <Link
        to="/voluntarios/nuevo"
        className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Nuevo voluntario
      </Link>

      <div className="mb-3 flex gap-2">
        <label className="relative block flex-1">
          <span className="sr-only">Buscar por nombre o profesión</span>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Nombre o profesión…"
            value={filtros.texto}
            onChange={(e) => cambiar({ texto: e.target.value })}
            className={`${claseInput} pl-10`}
          />
        </label>
        <button
          type="button"
          onClick={() => setPanel(!panel)}
          aria-expanded={panel}
          className={`relative flex items-center gap-1.5 rounded-lg border px-3 text-sm font-medium ${
            panel || nActivos
              ? 'border-primario-500 bg-primario-50 text-primario-700 dark:bg-primario-900/40 dark:text-primario-200'
              : 'border-slate-300 dark:border-slate-700'
          }`}
        >
          <IconoFiltro className="h-5 w-5" /> Filtros
          {nActivos > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primario-600 px-1 text-xs font-bold text-white">
              {nActivos}
            </span>
          )}
        </button>
      </div>

      {panel && datos && <PanelFiltros filtros={filtros} cambiar={cambiar} datos={datos} onCerrar={() => setPanel(false)} />}

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.texto}
              type="button"
              onClick={() => cambiar(c.quitar)}
              aria-label={`Quitar filtro ${c.texto}`}
              className="flex items-center gap-1 rounded-full bg-primario-100 py-1 pl-3 pr-2 text-sm font-medium text-primario-800 active:bg-primario-200 dark:bg-primario-900 dark:text-primario-100"
            >
              {c.texto} <IconoCerrar className="h-4 w-4" />
            </button>
          ))}
          {chips.length > 1 && (
            <button
              type="button"
              onClick={() => cambiar({ ...filtrosVacios(), texto: filtros.texto })}
              className="px-2 text-sm font-medium text-primario-600 dark:text-primario-300"
            >
              Quitar todos
            </button>
          )}
        </div>
      )}

      {!datos ? (
        <p className="text-slate-500">Cargando…</p>
      ) : datos.lista.length === 0 ? (
        <Vacio texto="Aún no hay voluntarios. Toque «Nuevo voluntario» para agregar el primero." />
      ) : visibles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <p>Ningún voluntario coincide con la búsqueda o los filtros.</p>
          <button
            type="button"
            onClick={() => setParams(new URLSearchParams(), { replace: true })}
            className="mt-3 font-medium text-primario-600 dark:text-primario-300"
          >
            Limpiar búsqueda y filtros
          </button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
            {visibles.length === datos.lista.length
              ? datos.lista.length === 1
                ? '1 voluntario'
                : `${datos.lista.length} voluntarios`
              : `${visibles.length} de ${datos.lista.length} voluntarios`}
          </p>
          <ul className="space-y-2">
            {visibles.map((v) => (
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

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-600 dark:text-slate-300">{titulo}</p>
      {children}
    </div>
  )
}

const edadDeInput = (t: string): number | null => {
  const n = parseInt(t, 10)
  return Number.isFinite(n) && n >= 0 && n <= 130 ? n : null
}

function PanelFiltros({
  filtros,
  cambiar,
  datos,
  onCerrar,
}: {
  filtros: FiltrosVoluntarios
  cambiar: (c: Partial<FiltrosVoluntarios>) => void
  datos: { congregaciones: { id: number; nombre: string }[]; limites: { edadMenor: number; edadMayor: number } }
  onCerrar: () => void
}) {
  const { edadMenor, edadMayor } = datos.limites
  return (
    <section className="mb-3 space-y-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <Grupo titulo="Congregación">
        <select
          value={filtros.congregacion}
          onChange={(e) => cambiar({ congregacion: e.target.value })}
          className={claseInput}
        >
          <option value="">Todas</option>
          {datos.congregaciones.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.nombre}
            </option>
          ))}
          <option value="invitados">Invitados puntuales</option>
          <option value="sin">Sin congregación</option>
        </select>
      </Grupo>

      <Grupo titulo="Vol. local o A-2">
        <Opciones
          valor={filtros.tipo}
          onCambiar={(tipo) => cambiar({ tipo })}
          opciones={[
            { valor: '', texto: 'Todos' },
            { valor: 'Local', texto: 'Local' },
            { valor: 'A-2', texto: 'A-2' },
          ]}
        />
      </Grupo>

      <Grupo titulo="Disponible">
        <select
          value={filtros.dia ?? ''}
          onChange={(e) => cambiar({ dia: e.target.value === '' ? null : Number(e.target.value) })}
          className={`${claseInput} mb-2`}
          aria-label="Día de la semana"
        >
          <option value="">Cualquier día</option>
          {ORDEN_SEMANA.map((d) => (
            <option key={d} value={d}>
              {NOMBRES_DIA[d]}
            </option>
          ))}
        </select>
        <Opciones<FiltroJornada>
          valor={filtros.jornada}
          onCambiar={(jornada) => cambiar({ jornada })}
          opciones={[
            { valor: '', texto: 'Cualquier jornada' },
            { valor: 'M', texto: 'Mañana' },
            { valor: 'T', texto: 'Tarde' },
            { valor: 'D', texto: 'Día completo' },
          ]}
        />
      </Grupo>

      <Grupo titulo="Edad (años)">
        <div className="mb-2 flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={130}
            placeholder="Desde"
            aria-label="Edad desde"
            value={filtros.edadMin ?? ''}
            onChange={(e) => cambiar({ edadMin: edadDeInput(e.target.value) })}
            className={claseInput}
          />
          <span className="text-slate-500">a</span>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={130}
            placeholder="Hasta"
            aria-label="Edad hasta"
            value={filtros.edadMax ?? ''}
            onChange={(e) => cambiar({ edadMax: edadDeInput(e.target.value) })}
            className={claseInput}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <BotonRapido onClick={() => cambiar({ edadMin: null, edadMax: edadMenor - 1 })}>
            Menores de {edadMenor}
          </BotonRapido>
          <BotonRapido onClick={() => cambiar({ edadMin: edadMayor + 1, edadMax: null })}>
            Mayores de {edadMayor}
          </BotonRapido>
        </div>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Quienes no tienen fecha de nacimiento no aparecen con este filtro.
        </p>
      </Grupo>

      <div className="flex justify-end gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        <button
          type="button"
          onClick={() => cambiar({ ...filtrosVacios(), texto: filtros.texto })}
          className="rounded-lg px-4 py-2 text-sm font-medium text-primario-600 dark:text-primario-300"
        >
          Quitar filtros
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg bg-primario-600 px-4 py-2 text-sm font-semibold text-white active:bg-primario-700"
        >
          Listo
        </button>
      </div>
    </section>
  )
}

function BotonRapido({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-slate-300 px-3 py-1 text-sm active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
    >
      {children}
    </button>
  )
}
