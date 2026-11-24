import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Asistencia as TipoAsistencia, Jornada, Tarea, Voluntario } from '../db/tipos'
import Pagina from '../components/Pagina'
import BotonEmergencia from '../components/BotonEmergencia'
import Opciones from '../components/Opciones'
import { claseInput, MensajeError } from '../components/Campos'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { IconoBuscar, IconoMasSimbolo } from '../components/Iconos'
import { fechaLarga, formatoHora, hoyISO, sumarDias } from '../lib/fechas'
import { fechaValida, NOMBRE_JORNADA } from '../lib/programacion'
import { ordenarTareas } from '../lib/tareas'
import { normalizar } from '../lib/texto'
import { ordenarVoluntarios } from '../lib/voluntarios'
import {
  desmarcarLlegada, errorHoras, filasAsistencia, horaPropuesta, jornadaActual, marcarLlegada, resumenAsistencia,
  salidaGeneral, tareaPropuesta, type FilaAsistencia,
} from '../lib/asistencia'

type Vista = 'todos' | 'faltan' | 'presentes'

export default function Asistencia() {
  const [params, setParams] = useSearchParams()
  const proyecto = useLiveQuery(() => db.obtenerProyecto())
  const fParam = params.get('f')
  const fecha = fechaValida(fParam) ? fParam : hoyISO()
  const jParam = params.get('j')
  const jornada: Jornada = jParam === 'M' || jParam === 'T' ? jParam : proyecto ? jornadaActual(proyecto) : 'M'
  const ir = (c: { f?: string; j?: Jornada }) => setParams({ f: c.f ?? fecha, j: c.j ?? jornada }, { replace: true })

  const datos = useLiveQuery(async () => {
    const [progs, asistencias, voluntarios, tareas] = await Promise.all([
      db.programaciones.where('fecha').equals(fecha).toArray(),
      db.asistencias.where('fecha').equals(fecha).toArray(),
      db.voluntarios.toArray(),
      db.tareas.toArray(),
    ])
    return { progs, asistencias, voluntarios: ordenarVoluntarios(voluntarios), tareas: ordenarTareas(tareas) }
  }, [fecha])

  const [vista, setVista] = useState<Vista>('todos')
  const [detalle, setDetalle] = useState<number | null>(null) // voluntarioId
  const [agregando, setAgregando] = useState(false)
  const [salida, setSalida] = useState(false)

  if (!proyecto || !datos) {
    return (
      <Pagina titulo="Asistencia">
        <BotonEmergencia />
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const mapa = new Map(datos.voluntarios.map((v) => [v.id, v]))
  const porJornada = (j: Jornada) =>
    filasAsistencia(
      datos.progs.filter((p) => p.jornada === j),
      datos.asistencias.filter((a) => a.jornada === j),
      mapa,
    )
  const filas = porJornada(jornada)
  const resumen = resumenAsistencia(filas)
  const resumenes = { M: resumenAsistencia(porJornada('M')), T: resumenAsistencia(porJornada('T')) }
  const visibles = filas.filter((f) => (vista === 'faltan' ? !f.presente : vista === 'presentes' ? f.presente : true))
  const filaDetalle = detalle === null ? null : (filas.find((f) => f.voluntarioId === detalle) ?? null)
  const esHoy = fecha === hoyISO()

  async function tocar(f: FilaAsistencia) {
    if (f.presente) {
      setDetalle(f.voluntarioId)
      return
    }
    await marcarLlegada(
      db,
      { fecha, jornada, voluntarioId: f.voluntarioId, tareaId: f.asistencia?.tareaId ?? tareaPropuesta(f) },
      horaPropuesta(fecha, jornada, proyecto!, 'llegada'),
    )
  }

  return (
    <Pagina titulo="Asistencia">
      <BotonEmergencia />

      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          aria-label="Día anterior"
          onClick={() => ir({ f: sumarDias(fecha, -1) })}
          className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 text-xl active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
        >
          ‹
        </button>
        <input
          type="date"
          aria-label="Fecha"
          value={fecha}
          onChange={(e) => fechaValida(e.target.value) && ir({ f: e.target.value })}
          className={`${claseInput} text-center`}
        />
        <button
          type="button"
          aria-label="Día siguiente"
          onClick={() => ir({ f: sumarDias(fecha, 1) })}
          className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 text-xl active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
        >
          ›
        </button>
      </div>
      <p className="mb-3 text-center text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold capitalize">{fechaLarga(fecha)}</span>
        {esHoy ? ' · hoy' : (
          <button type="button" onClick={() => ir({ f: hoyISO() })} className="ml-2 font-medium text-primario-600 dark:text-primario-300">
            Ir a hoy
          </button>
        )}
      </p>

      <div className="mb-3 grid grid-cols-2 gap-2" role="tablist">
        {(['M', 'T'] as Jornada[]).map((j) => {
          const r = resumenes[j]
          const activa = j === jornada
          return (
            <button
              key={j}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => ir({ j })}
              className={`rounded-xl px-3 py-2 text-left ${
                activa ? 'bg-primario-600 text-white' : 'bg-white shadow-sm active:bg-slate-100 dark:bg-slate-900 dark:active:bg-slate-800'
              }`}
            >
              <span className="block font-semibold">{NOMBRE_JORNADA[j]}</span>
              <span className={`block text-sm ${activa ? 'text-primario-100' : 'text-slate-500 dark:text-slate-400'}`}>
                {r.presentes} presentes / {r.programados} prog.
              </span>
            </button>
          )
        })}
      </div>

      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
        <Cifra n={resumen.programados} t="programados" />
        <Cifra n={resumen.presentes} t="presentes" color="verde" />
        <Cifra n={resumen.faltan} t="faltan" color={resumen.faltan ? 'ambar' : undefined} />
        <Cifra n={resumen.noProgramados} t="no prog." />
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
        <Opciones<Vista>
          valor={vista}
          onCambiar={setVista}
          opciones={[
            { valor: 'todos', texto: 'Todos' },
            { valor: 'faltan', texto: 'Faltan' },
            { valor: 'presentes', texto: 'Presentes' },
          ]}
        />
      </div>

      {filas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Nadie programado en la {NOMBRE_JORNADA[jornada].toLowerCase()}. Puede agregar a quienes llegaron con «Agregar no
          programado».
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((f) => {
            const a = f.asistencia
            const tarea = datos.tareas.find((t) => t.id === (a?.tareaId ?? tareaPropuesta(f)))
            return (
              <li key={f.voluntarioId} className="flex items-stretch overflow-hidden rounded-xl bg-white shadow-sm dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => tocar(f)}
                  aria-pressed={f.presente}
                  aria-label={f.presente ? `${f.nombre}: presente` : `Marcar llegada de ${f.nombre}`}
                  className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left ${
                    f.presente ? 'bg-green-50 active:bg-green-100 dark:bg-green-950/40' : 'active:bg-slate-100 dark:active:bg-slate-800'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                      f.presente ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 text-transparent dark:border-slate-600'
                    }`}
                  >
                    ✓
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {f.nombre}
                      {f.noProgramado && <span className="ml-1 text-xs font-medium text-amber-700 dark:text-amber-300">(no programado)</span>}
                    </span>
                    <span className="block truncate text-sm text-slate-500 dark:text-slate-400">
                      {f.presente
                        ? `Llegó ${formatoHora(a?.horaLlegada) || '—'}${a?.horaSalida ? ` · salió ${formatoHora(a.horaSalida)}` : ''}`
                        : a && !a.asistio
                          ? 'No asistió'
                          : 'Toque para marcar llegada'}
                      {(a?.tareaTexto || tarea) && ` · ${a?.tareaTexto || tarea?.nombre}`}
                    </span>
                    {a?.observacion && <span className="block truncate text-xs italic text-slate-500">{a.observacion}</span>}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setDetalle(f.voluntarioId)}
                  aria-label={`Detalle de ${f.nombre}`}
                  className="w-12 shrink-0 border-l border-slate-100 text-xl text-slate-500 active:bg-slate-100 dark:border-slate-800 dark:active:bg-slate-800"
                >
                  ⋯
                </button>
              </li>
            )
          })}
          {visibles.length === 0 && (
            <li className="p-4 text-center text-sm text-slate-500">{vista === 'faltan' ? '¡Llegaron todos!' : 'Nadie todavía.'}</li>
          )}
        </ul>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAgregando(true)} className={`flex items-center justify-center gap-1.5 ${claseBotonSecundario}`}>
          <IconoMasSimbolo className="h-4 w-4" /> Agregar no programado
        </button>
        <button type="button" disabled={resumen.sinSalida === 0} onClick={() => setSalida(true)} className={claseBotonPrimario}>
          Salida general{resumen.sinSalida ? ` (${resumen.sinSalida})` : ''}
        </button>
      </div>

      {salida && (
        <DialogoSalida
          fecha={fecha}
          jornada={jornada}
          cuantos={resumen.sinSalida}
          horaInicial={horaPropuesta(fecha, jornada, proyecto, 'salida')}
          onCerrar={() => setSalida(false)}
        />
      )}

      {filaDetalle && (
        <DetalleAsistencia
          key={filaDetalle.voluntarioId}
          fila={filaDetalle}
          fecha={fecha}
          jornada={jornada}
          tareas={datos.tareas}
          horaLlegada={horaPropuesta(fecha, jornada, proyecto, 'llegada')}
          horaSalida={horaPropuesta(fecha, jornada, proyecto, 'salida')}
          onCerrar={() => setDetalle(null)}
        />
      )}

      {agregando && (
        <AgregarNoProgramado
          voluntarios={datos.voluntarios}
          yaEstan={new Set(filas.map((f) => f.voluntarioId))}
          onElegir={async (v) => {
            await marcarLlegada(
              db,
              { fecha, jornada, voluntarioId: v.id, tareaId: v.tareaHabitualId ?? null },
              horaPropuesta(fecha, jornada, proyecto, 'llegada'),
            )
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}
    </Pagina>
  )
}

function Cifra({ n, t, color }: { n: number; t: string; color?: 'verde' | 'ambar' }) {
  const c =
    color === 'verde'
      ? 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200'
      : color === 'ambar'
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-white shadow-sm dark:bg-slate-900'
  return (
    <div className={`rounded-lg px-1 py-1.5 ${c}`}>
      <p className="text-lg font-bold tabular-nums">{n}</p>
      <p>{t}</p>
    </div>
  )
}

function DialogoSalida({
  fecha,
  jornada,
  cuantos,
  horaInicial,
  onCerrar,
}: {
  fecha: string
  jornada: Jornada
  cuantos: number
  horaInicial: string
  onCerrar: () => void
}) {
  const [hora, setHora] = useState(horaInicial)
  return (
    <Dialogo
      abierto
      titulo="Salida general"
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!hora}
            onClick={async () => {
              await salidaGeneral(db, fecha, jornada, hora)
              onCerrar()
            }}
            className={claseBotonPrimario}
          >
            Marcar salida
          </button>
        </>
      }
    >
      <p className="mb-3">
        Se marcará la salida de {cuantos} {cuantos === 1 ? 'persona presente' : 'personas presentes'} que aún no la tienen.
      </p>
      <input type="time" aria-label="Hora de salida" value={hora} onChange={(e) => setHora(e.target.value)} className={claseInput} />
    </Dialogo>
  )
}

function DetalleAsistencia({
  fila,
  fecha,
  jornada,
  tareas,
  horaLlegada,
  horaSalida,
  onCerrar,
}: {
  fila: FilaAsistencia
  fecha: string
  jornada: Jornada
  tareas: Tarea[]
  horaLlegada: string
  horaSalida: string
  onCerrar: () => void
}) {
  const a = fila.asistencia
  const [asistio, setAsistio] = useState(a ? a.asistio : true)
  const [llegada, setLlegada] = useState(a?.horaLlegada ?? (a ? '' : horaLlegada))
  const [salida, setSalida] = useState(a?.horaSalida ?? '')
  const [tareaId, setTareaId] = useState<string>(String(a?.tareaId ?? tareaPropuesta(fila) ?? ''))
  const [tareaTexto, setTareaTexto] = useState(a?.tareaTexto ?? '')
  const [observacion, setObservacion] = useState(a?.observacion ?? '')
  const error = asistio ? errorHoras(llegada, salida) : null

  async function guardar() {
    if (error) return
    const datos: Partial<TipoAsistencia> = {
      asistio,
      horaLlegada: asistio && llegada ? llegada : undefined,
      horaSalida: asistio && salida ? salida : undefined,
      tareaId: tareaId ? Number(tareaId) : null,
      tareaTexto: tareaTexto.trim() || undefined,
      observacion: observacion.trim(),
    }
    if (a) await db.asistencias.update(a.id, datos)
    else await db.asistencias.add({ fecha, jornada, voluntarioId: fila.voluntarioId, ...datos } as TipoAsistencia)
    onCerrar()
  }

  async function borrar() {
    if (a) {
      if (fila.noProgramado) await db.asistencias.delete(a.id)
      else await desmarcarLlegada(db, a.id)
    }
    onCerrar()
  }

  return (
    <Dialogo
      abierto
      titulo={fila.nombre}
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={guardar} disabled={!!error} className={claseBotonPrimario}>
            Guardar
          </button>
        </>
      }
    >
      <div className="space-y-3 text-slate-900 dark:text-slate-100">
        <Opciones<'si' | 'no'>
          valor={asistio ? 'si' : 'no'}
          onCambiar={(v) => setAsistio(v === 'si')}
          opciones={[
            { valor: 'si', texto: 'Asistió' },
            { valor: 'no', texto: 'No asistió' },
          ]}
        />
        {asistio && (
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-sm">
              Llegada
              <input type="time" value={llegada} onChange={(e) => setLlegada(e.target.value)} className={claseInput} />
            </label>
            <label className="block text-sm">
              Salida
              <div className="flex gap-1">
                <input type="time" value={salida} onChange={(e) => setSalida(e.target.value)} className={claseInput} />
              </div>
            </label>
            {!salida && (
              <button type="button" onClick={() => setSalida(horaSalida)} className="col-span-2 text-sm font-medium text-primario-600 dark:text-primario-300">
                Marcar salida ({formatoHora(horaSalida)})
              </button>
            )}
          </div>
        )}
        <MensajeError texto={error ?? undefined} />
        <label className="block text-sm">
          Tarea realizada
          <select value={tareaId} onChange={(e) => setTareaId(e.target.value)} className={claseInput}>
            <option value="">— Sin tarea —</option>
            {tareas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Otra tarea o detalle (opcional)
          <input value={tareaTexto} onChange={(e) => setTareaTexto(e.target.value)} className={claseInput} />
        </label>
        <label className="block text-sm">
          Observación
          <textarea rows={2} value={observacion} onChange={(e) => setObservacion(e.target.value)} className={claseInput} />
        </label>
        {a?.asistio && (
          <button type="button" onClick={borrar} className={`w-full ${claseBotonPeligro}`}>
            {fila.noProgramado ? 'Quitar de la asistencia' : 'Desmarcar llegada'}
          </button>
        )}
      </div>
    </Dialogo>
  )
}

function AgregarNoProgramado({
  voluntarios,
  yaEstan,
  onElegir,
  onCerrar,
}: {
  voluntarios: Voluntario[]
  yaEstan: Set<number>
  onElegir: (v: Voluntario) => Promise<void>
  onCerrar: () => void
}) {
  const [busqueda, setBusqueda] = useState('')
  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])
  const palabras = normalizar(busqueda).split(' ').filter(Boolean)
  const lista = voluntarios.filter(
    (v) => !yaEstan.has(v.id) && palabras.every((p) => `${v.nombreNorm} ${v.profesionNorm}`.includes(p)),
  )
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-50 dark:bg-slate-950" role="dialog" aria-label="Agregar no programado">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between py-3">
          <h2 className="text-lg font-bold text-primario-700 dark:text-primario-200">¿Quién llegó?</h2>
          <button type="button" onClick={onCerrar} className={claseBotonPrimario}>
            Listo
          </button>
        </div>
        <label className="relative mb-2 block">
          <span className="sr-only">Buscar</span>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            autoFocus
            placeholder="Buscar por nombre…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={`${claseInput} pl-10`}
          />
        </label>
        <ul className="flex-1 space-y-2 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {lista.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => onElegir(v)}
                className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-3 text-left shadow-sm active:bg-green-50 dark:bg-slate-900 dark:active:bg-green-950"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{v.nombre}</span>
                  <span className="block truncate text-sm text-slate-500 dark:text-slate-400">{v.profesion || '—'}</span>
                </span>
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">Llegó ✓</span>
              </button>
            </li>
          ))}
          {lista.length === 0 && <li className="p-4 text-center text-sm text-slate-500">No hay más voluntarios.</li>}
        </ul>
      </div>
    </div>
  )
}
