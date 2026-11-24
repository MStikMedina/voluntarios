import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Confirmacion, Jornada, Programacion as Prog, Tarea, Voluntario } from '../db/tipos'
import Pagina from '../components/Pagina'
import { claseInput } from '../components/Campos'
import TelefonoAcciones from '../components/TelefonoAcciones'
import CompartirTexto from '../components/CompartirTexto'
import Opciones from '../components/Opciones'
import { textoProgramacion } from '../lib/mensajes'
import Dialogo, { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { IconoBuscar, IconoCerrar, IconoMasSimbolo } from '../components/Iconos'
import { diaSemana, fechaLarga, formatoHora, hoyISO } from '../lib/fechas'
import { disponibleEn } from '../lib/disponibilidad'
import { celularPrincipal, ordenarVoluntarios } from '../lib/voluntarios'
import { ordenarTareas } from '../lib/tareas'
import { normalizar } from '../lib/texto'
import {
  agruparPorTarea, avisosAlProgramar, copiarProgramacion, fechaInicialProgramacion, fechaValida, guardarCupo,
  guardarCupoTarea, NOMBRE_CONFIRMACION, NOMBRE_JORNADA, otroDiaTrabajo, programar, quitarProgramacion,
  resumenJornada, sugeridos, tareasDeFecha, TEXTO_AVISO, type ResumenJornada,
} from '../lib/programacion'

type ProgVol = Prog & { nombre: string; voluntario?: Voluntario }

export default function Programacion() {
  const [params, setParams] = useSearchParams()
  const proyecto = useLiveQuery(() => db.obtenerProyecto())
  const fParam = params.get('f')
  const fecha = fechaValida(fParam) ? fParam : proyecto ? fechaInicialProgramacion(proyecto.diasTrabajo) : hoyISO()
  const jornada: Jornada = params.get('j') === 'T' ? 'T' : 'M'
  const ir = (cambios: { f?: string; j?: Jornada }) =>
    setParams({ f: cambios.f ?? fecha, j: cambios.j ?? jornada }, { replace: true })

  const datos = useLiveQuery(async () => {
    const [dia, progs, voluntarios, tareas] = await Promise.all([
      db.dias.get(fecha),
      db.programaciones.where('fecha').equals(fecha).toArray(),
      db.voluntarios.toArray(),
      db.tareas.toArray(),
    ])
    const porId = new Map(voluntarios.map((v) => [v.id, v]))
    const lista: ProgVol[] = progs.map((p) => ({ ...p, voluntario: porId.get(p.voluntarioId), nombre: porId.get(p.voluntarioId)?.nombre ?? '(borrado)' }))
    return { dia: dia ?? null, progs: lista, voluntarios: ordenarVoluntarios(voluntarios), tareas: ordenarTareas(tareas) }
  }, [fecha])

  const [agregando, setAgregando] = useState(false)
  const [copiar, setCopiar] = useState(false)
  const [compartir, setCompartir] = useState(false)
  const [jornadasTexto, setJornadasTexto] = useState<'ambas' | Jornada>('ambas')

  if (!proyecto || !datos) {
    return (
      <Pagina titulo="Programación">
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const tareasFecha = tareasDeFecha(datos.tareas, fecha)
  // Tareas a mostrar: las vigentes en la fecha y cualquier otra que ya tenga programados.
  const usadas = new Set(datos.progs.map((p) => p.tareaId).filter((x): x is number => x != null))
  const tareasVista = datos.tareas.filter((t) => tareasFecha.includes(t) || usadas.has(t.id))
  const resumenes = {
    M: resumenJornada(datos.progs, 'M', datos.dia, tareasVista),
    T: resumenJornada(datos.progs, 'T', datos.dia, tareasVista),
  }
  const resumen = resumenes[jornada]
  const deJornada = datos.progs.filter((p) => p.jornada === jornada)
  const esDiaTrabajo = proyecto.diasTrabajo.includes(diaSemana(fecha))
  const horario = proyecto.jornadas[jornada]

  return (
    <Pagina titulo="Programación">
      {/* Fecha */}
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          aria-label="Día de trabajo anterior"
          onClick={() => ir({ f: otroDiaTrabajo(fecha, -1, proyecto.diasTrabajo) })}
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
          aria-label="Día de trabajo siguiente"
          onClick={() => ir({ f: otroDiaTrabajo(fecha, 1, proyecto.diasTrabajo) })}
          className="h-11 w-11 shrink-0 rounded-lg border border-slate-300 text-xl active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
        >
          ›
        </button>
      </div>
      <p className="mb-3 text-center text-sm text-slate-600 dark:text-slate-300">
        <span className="font-semibold capitalize">{fechaLarga(fecha)}</span>
        {fecha === hoyISO() && ' · hoy'}
        {!esDiaTrabajo && <span className="text-amber-700 dark:text-amber-300"> · no es día de trabajo</span>}
      </p>

      {/* Jornadas */}
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
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
                {r.programados} / {r.cupo ?? 'sin cupo'}
              </span>
            </button>
          )
        })}
      </div>

      <TarjetaCupo
        key={`${fecha}-${jornada}`}
        fecha={fecha}
        jornada={jornada}
        resumen={resumen}
        horario={`${formatoHora(horario.inicio)} – ${formatoHora(horario.fin)}`}
      />

      {tareasVista.length > 0 && (
        <CuposTarea fecha={fecha} resumen={resumen} tareas={tareasVista} dia={datos.dia} />
      )}

      <button
        type="button"
        onClick={() => setAgregando(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Agregar voluntarios
      </button>

      <ListaProgramados lista={deJornada} tareas={tareasVista} todasTareas={datos.tareas} fecha={fecha} jornada={jornada} />

      {datos.progs.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link to={`/programacion/enviar?f=${fecha}&j=${jornada}`} className={`text-center ${claseBotonSecundario}`}>
            ✉ Envío guiado
          </Link>
          <button type="button" onClick={() => setCompartir(true)} className={claseBotonSecundario}>
            Compartir texto
          </button>
          <Link to={`/programacion/hoja?f=${fecha}`} className={`text-center ${claseBotonSecundario}`}>
            Imagen / PDF
          </Link>
          <button type="button" onClick={() => setCopiar(true)} className={claseBotonSecundario}>
            Copiar a otra fecha…
          </button>
        </div>
      )}

      {compartir && (
        <CompartirTexto
          titulo="Compartir programación"
          onCerrar={() => setCompartir(false)}
          opciones={
            <div className="mb-3">
              <Opciones<'ambas' | Jornada>
                valor={jornadasTexto}
                onCambiar={setJornadasTexto}
                opciones={[
                  { valor: 'ambas', texto: 'Ambas jornadas' },
                  { valor: 'M', texto: 'Mañana' },
                  { valor: 'T', texto: 'Tarde' },
                ]}
              />
            </div>
          }
          texto={textoProgramacion({
            proyecto,
            fecha,
            jornadas: jornadasTexto === 'ambas' ? ['M', 'T'] : [jornadasTexto],
            programaciones: datos.progs,
            voluntarios: new Map(datos.voluntarios.map((v) => [v.id, v])),
            tareas: datos.tareas,
          })}
        />
      )}

      {agregando && (
        <PanelAgregar
          fecha={fecha}
          jornada={jornada}
          voluntarios={datos.voluntarios}
          tareas={tareasFecha}
          resumen={resumen}
          yaProgramados={new Set(deJornada.map((p) => p.voluntarioId))}
          onCerrar={() => setAgregando(false)}
        />
      )}

      {copiar && (
      <DialogoCopiar
        desde={fecha}
        sugerida={otroDiaTrabajo(fecha, 1, proyecto.diasTrabajo)}
        onCerrar={() => setCopiar(false)}
        onCopiado={(f) => ir({ f })}
      />
      )}
    </Pagina>
  )
}

// --- Cupo general de la jornada ---

function TarjetaCupo({
  fecha,
  jornada,
  resumen,
  horario,
}: {
  fecha: string
  jornada: Jornada
  resumen: ResumenJornada
  horario: string
}) {
  const [texto, setTexto] = useState(resumen.cupo === null ? '' : String(resumen.cupo))
  const guardado = resumen.cupo === null ? '' : String(resumen.cupo)
  const ultimo = useRef(guardado)
  // Si cambia desde otro lado (p. ej. copiar), reflejarlo.
  useEffect(() => {
    if (guardado !== ultimo.current) {
      ultimo.current = guardado
      setTexto(guardado)
    }
  }, [guardado])

  // Se guarda en cada cambio válido (vacío = sin cupo).
  async function cambiar(t: string) {
    setTexto(t)
    const n = parseInt(t, 10)
    if (t.trim() !== '' && !(Number.isFinite(n) && n >= 0)) return
    const valor = t.trim() === '' ? null : n
    ultimo.current = valor === null ? '' : String(valor)
    await guardarCupo(db, fecha, jornada, valor)
  }

  const { cupo, programados, faltan } = resumen
  return (
    <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center gap-3">
        <label className="flex-1">
          <span className="block text-sm font-medium text-slate-600 dark:text-slate-300">
            Cupo de la {NOMBRE_JORNADA[jornada].toLowerCase()} *
          </span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">{horario}</span>
        </label>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          aria-label="Cupo general"
          placeholder="¿Cuántos?"
          value={texto}
          onChange={(e) => cambiar(e.target.value)}
          onBlur={() => setTexto(ultimo.current)}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`${claseInput} w-28! shrink-0 text-center text-lg font-semibold ${cupo === null ? 'border-red-500 dark:border-red-500' : ''}`}
        />
      </div>
      {cupo === null ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          Sin cupo: escriba cuántas personas se necesitan en esta jornada.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <Dato numero={programados} texto="programados" />
          <Dato
            numero={faltan! < 0 ? `+${-faltan!}` : faltan!}
            texto={faltan! < 0 ? 'sobre el cupo' : 'faltan'}
            color={faltan! < 0 ? 'rojo' : faltan! > 0 ? 'ambar' : 'verde'}
          />
          <Dato numero={resumen.confirmados} texto="confirmados" />
        </div>
      )}
      {(resumen.noPuede > 0 || (cupo !== null && resumen.pendientes > 0)) && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {resumen.pendientes} sin confirmar{resumen.noPuede ? ` · ${resumen.noPuede} no pueden (no cuentan en el cupo)` : ''}
        </p>
      )}
    </section>
  )
}

function Dato({ numero, texto, color }: { numero: number | string; texto: string; color?: 'rojo' | 'ambar' | 'verde' }) {
  const c =
    color === 'rojo'
      ? 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
      : color === 'ambar'
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : color === 'verde'
          ? 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200'
          : 'bg-slate-100 dark:bg-slate-800'
  return (
    <div className={`rounded-lg px-2 py-1.5 ${c}`}>
      <p className="text-lg font-bold tabular-nums">{numero}</p>
      <p className="text-xs">{texto}</p>
    </div>
  )
}

// --- Cupos por tarea ---

function CuposTarea({
  fecha,
  resumen,
  tareas,
  dia,
}: {
  fecha: string
  resumen: ResumenJornada
  tareas: Tarea[]
  dia: { cuposTarea?: Record<number, number> } | null
}) {
  const [abierto, setAbierto] = useState(false)
  const excedidas = resumen.porTarea.filter((r) => r.tareaId !== null && r.cupo !== null && r.programados > r.cupo).length
  return (
    <section className="mb-4 rounded-xl bg-white shadow-sm dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-semibold text-primario-700 dark:text-primario-200">Por tarea</span>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {excedidas > 0 && <span className="mr-2 text-red-600 dark:text-red-400">⚠ {excedidas} sobre el cupo</span>}
          {abierto ? '▲' : '▼'}
        </span>
      </button>
      {abierto && (
        <ul className="divide-y divide-slate-100 border-t border-slate-100 px-4 dark:divide-slate-800 dark:border-slate-800">
          {tareas.map((t) => {
            const r = resumen.porTarea.find((x) => x.tareaId === t.id)!
            const ajustado = dia?.cuposTarea?.[t.id]
            const excedida = r.cupo !== null && r.programados > r.cupo
            return (
              <li key={t.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.nombre}</p>
                  <p className={`text-sm ${excedida ? 'font-semibold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {r.programados} / {r.cupo ?? 'sin cupo'}
                    {ajustado !== undefined && ' (ajustado hoy)'}
                  </p>
                </div>
                <CupoTareaInput fecha={fecha} tarea={t} ajustado={ajustado} />
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function CupoTareaInput({ fecha, tarea, ajustado }: { fecha: string; tarea: Tarea; ajustado: number | undefined }) {
  const [texto, setTexto] = useState(ajustado === undefined ? '' : String(ajustado))
  async function cambiar(t: string) {
    setTexto(t)
    const n = parseInt(t, 10)
    if (t.trim() !== '' && !(Number.isFinite(n) && n >= 0)) return
    await guardarCupoTarea(db, fecha, tarea.id, t.trim() === '' ? null : n)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      aria-label={`Cupo de ${tarea.nombre} en esta fecha`}
      placeholder={tarea.personasNecesarias ? String(tarea.personasNecesarias) : '—'}
      title="Cupo en esta fecha (vacío = personas necesarias de la tarea)"
      value={texto}
      onChange={(e) => cambiar(e.target.value)}
      className={`${claseInput} w-20! shrink-0 py-1.5 text-center`}
    />
  )
}

// --- Lista de programados ---

const COLOR_CONF: Record<Confirmacion, string> = {
  pendiente: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100',
  confirmado: 'bg-green-600 text-white',
  no_puede: 'bg-red-600 text-white',
}

function ListaProgramados({
  lista,
  tareas,
  todasTareas,
  fecha,
  jornada,
}: {
  lista: ProgVol[]
  tareas: Tarea[]
  todasTareas: Tarea[]
  fecha: string
  jornada: Jornada
}) {
  const [quitar, setQuitar] = useState<ProgVol | null>(null)
  if (lista.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
        Nadie programado en la {NOMBRE_JORNADA[jornada].toLowerCase()}. Toque «Agregar voluntarios».
      </div>
    )
  }
  const grupos = agruparPorTarea(lista, todasTareas)
  return (
    <>
      {grupos.map((g) => (
        <section key={g.tarea?.id ?? 'sin'} className="mb-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {g.tarea?.nombre ?? 'Sin tarea'} ({g.items.length})
          </h2>
          <ul className="space-y-2">
            {g.items.map((p) => {
              const fuera = p.voluntario && !disponibleEn(p.voluntario, fecha, jornada)
              return (
                <li
                  key={p.id}
                  className={`rounded-xl bg-white p-3 shadow-sm dark:bg-slate-900 ${p.confirmacion === 'no_puede' ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Link to={`/voluntarios/${p.voluntarioId}`} className="block truncate font-semibold">
                        {p.nombre}
                      </Link>
                      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                        {p.voluntario?.profesion || '—'}
                        {p.mensajeEnviado && ' · ✉ mensaje enviado'}
                      </p>
                      {fuera && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">⚠ Fuera de su disponibilidad</p>}
                    </div>
                    {p.voluntario && <TelefonoAcciones numero={celularPrincipal(p.voluntario)} etiqueta={p.nombre} compacto />}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      aria-label={`Tarea de ${p.nombre}`}
                      value={p.tareaId ?? ''}
                      onChange={(e) => db.programaciones.update(p.id, { tareaId: e.target.value ? Number(e.target.value) : null })}
                      className={`${claseInput} min-w-0 flex-1 py-1.5 text-sm`}
                    >
                      <option value="">Sin tarea</option>
                      {todasTareas
                        .filter((t) => tareas.includes(t) || t.id === p.tareaId)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nombre}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Quitar a ${p.nombre}`}
                      onClick={() => setQuitar(p)}
                      className="shrink-0 rounded-lg p-2 text-slate-500 active:bg-slate-100 dark:active:bg-slate-800"
                    >
                      <IconoCerrar className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Confirmación">
                    {(['pendiente', 'confirmado', 'no_puede'] as Confirmacion[]).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={p.confirmacion === c}
                        onClick={() => db.programaciones.update(p.id, { confirmacion: c })}
                        className={`rounded-lg py-1.5 text-xs font-semibold ${
                          p.confirmacion === c ? COLOR_CONF[c] : 'bg-slate-50 text-slate-500 dark:bg-slate-950 dark:text-slate-400'
                        }`}
                      >
                        {NOMBRE_CONFIRMACION[c]}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      <Dialogo
        abierto={quitar !== null}
        titulo="¿Quitar de la programación?"
        onCerrar={() => setQuitar(null)}
        acciones={
          <>
            <button type="button" onClick={() => setQuitar(null)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                if (quitar) await quitarProgramacion(db, quitar.id)
                setQuitar(null)
              }}
              className={claseBotonPrimario}
            >
              Quitar
            </button>
          </>
        }
      >
        «{quitar?.nombre}» dejará de estar programado en esta jornada.
      </Dialogo>
    </>
  )
}

// --- Agregar voluntarios ---

function PanelAgregar({
  fecha,
  jornada,
  voluntarios,
  tareas,
  resumen,
  yaProgramados,
  onCerrar,
}: {
  fecha: string
  jornada: Jornada
  voluntarios: Voluntario[]
  tareas: Tarea[]
  resumen: ResumenJornada
  yaProgramados: Set<number>
  onCerrar: () => void
}) {
  const [tareaSel, setTareaSel] = useState<string>('') // '' = la habitual de cada uno
  const [busqueda, setBusqueda] = useState('')
  const [todos, setTodos] = useState(false)
  const [avisos, setAvisos] = useState<{ nombre: string; textos: string[] }[]>([])
  const tarea = tareas.find((t) => String(t.id) === tareaSel) ?? null

  useEffect(() => {
    const anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = anterior
    }
  }, [])

  const palabras = normalizar(busqueda).split(' ').filter(Boolean)
  const lista = sugeridos(voluntarios, fecha, jornada, yaProgramados, tarea, todos || palabras.length > 0).filter(
    (s) => !palabras.length || palabras.every((p) => `${s.voluntario.nombreNorm} ${s.voluntario.profesionNorm}`.includes(p)),
  )
  const nombreTarea = (id: number | null | undefined) => tareas.find((t) => t.id === id)?.nombre

  async function agregar(v: Voluntario) {
    const tareaId = tarea ? tarea.id : tareas.some((t) => t.id === v.tareaHabitualId) ? v.tareaHabitualId! : null
    const a = avisosAlProgramar(v, fecha, jornada, resumen, tareaId)
    await programar(db, { fecha, jornada, voluntarioId: v.id, tareaId })
    const textos = a.filter((x) => x !== 'sin_cupo').map((x) => TEXTO_AVISO[x])
    if (textos.length) setAvisos((prev) => [{ nombre: v.nombre, textos }, ...prev].slice(0, 3))
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-slate-50 dark:bg-slate-950" role="dialog" aria-label="Agregar voluntarios">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-hidden px-4 pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between py-3">
          <div>
            <h2 className="text-lg font-bold text-primario-700 dark:text-primario-200">Agregar voluntarios</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="capitalize">{fechaLarga(fecha)}</span> · {NOMBRE_JORNADA[jornada]} · {resumen.programados} /{' '}
              {resumen.cupo ?? 'sin cupo'}
            </p>
          </div>
          <button type="button" onClick={onCerrar} className={claseBotonPrimario}>
            Listo
          </button>
        </div>

        <div className="space-y-2 pb-2">
          <select
            aria-label="Tarea para los que agregue"
            value={tareaSel}
            onChange={(e) => setTareaSel(e.target.value)}
            className={claseInput}
          >
            <option value="">Tarea: la habitual de cada uno</option>
            {tareas.map((t) => (
              <option key={t.id} value={t.id}>
                Tarea: {t.nombre}
                {t.habilidadRequerida ? ` (${t.habilidadRequerida})` : ''}
              </option>
            ))}
          </select>
          <label className="relative block">
            <span className="sr-only">Buscar</span>
            <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Buscar por nombre o profesión…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${claseInput} pl-10`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={todos} onChange={(e) => setTodos(e.target.checked)} className="h-4 w-4 accent-primario-600" />
            Mostrar también a los no disponibles ese día
          </label>
          {avisos.map((a, i) => (
            <p key={i} className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              ⚠ {a.nombre}: {a.textos.join('; ')}.
            </p>
          ))}
        </div>

        <ul className="flex-1 space-y-2 overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {lista.length === 0 && (
            <li className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {voluntarios.length === 0
                ? 'Aún no hay voluntarios.'
                : 'No hay más voluntarios disponibles. Marque «Mostrar también a los no disponibles» o busque por nombre.'}
            </li>
          )}
          {lista.map(({ voluntario: v, disponible, coincide, habitual }) => (
            <li key={v.id} className="flex items-center gap-3 rounded-xl bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {v.nombre}
                  {(coincide || habitual) && <span className="ml-1 text-amber-500" title="Coincide con la tarea">★</span>}
                </p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                  {[v.profesion, nombreTarea(v.tareaHabitualId) && `habitual: ${nombreTarea(v.tareaHabitualId)}`].filter(Boolean).join(' · ') || '—'}
                </p>
                {!disponible && <p className="text-xs font-medium text-amber-700 dark:text-amber-300">No disponible ese día/jornada</p>}
              </div>
              <button
                type="button"
                onClick={() => agregar(v)}
                aria-label={`Agregar a ${v.nombre}`}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primario-600 text-white active:bg-primario-700"
              >
                <IconoMasSimbolo className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// --- Copiar a otra fecha ---

function DialogoCopiar({
  desde,
  sugerida,
  onCerrar,
  onCopiado,
}: {
  desde: string
  sugerida: string
  onCerrar: () => void
  onCopiado: (fecha: string) => void
}) {
  const [hacia, setHacia] = useState(sugerida)
  async function copiar() {
    if (!fechaValida(hacia) || hacia === desde) return
    await copiarProgramacion(db, desde, hacia)
    onCerrar()
    onCopiado(hacia)
  }
  return (
    <Dialogo
      abierto
      titulo="Copiar programación"
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button type="button" disabled={!fechaValida(hacia) || hacia === desde} onClick={copiar} className={claseBotonPrimario}>
            Copiar
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        Se copian las dos jornadas (con sus tareas y cupos) a la fecha elegida. Quien ya esté programado allí no se repite y
        todas las confirmaciones quedan «pendientes».
      </p>
      <input type="date" aria-label="Copiar a" value={hacia} onChange={(e) => setHacia(e.target.value)} className={claseInput} />
    </Dialogo>
  )
}
