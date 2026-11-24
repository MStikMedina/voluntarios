import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Jornada } from '../db/tipos'
import Pagina from '../components/Pagina'
import BotonEmergencia from '../components/BotonEmergencia'
import AvisoRespaldo from '../components/AvisoRespaldo'
import { IconoAsistencia, IconoMasSimbolo, IconoProgramacion, IconoVoluntarios } from '../components/Iconos'
import { NOMBRES_DIA, diaSemana, formatoFecha, hoyISO, sumarDias } from '../lib/fechas'
import { filasAsistencia, jornadaActual, resumenAsistencia } from '../lib/asistencia'
import { estadoJornada, proximosDias, type JornadaPanel } from '../lib/panel'
import { NOMBRE_JORNADA } from '../lib/programacion'

// Panel de inicio (PLAN.md §2.10).
export default function Inicio() {
  const hoy = hoyISO()
  const datos = useLiveQuery(async () => {
    const fin = sumarDias(hoy, 6)
    const [proyecto, congregaciones, voluntarios, tareas, dias, progs, asistenciasHoy] = await Promise.all([
      db.obtenerProyecto(),
      db.congregaciones.count(),
      db.voluntarios.toArray(),
      db.tareas.count(),
      db.dias.where('fecha').between(hoy, fin, true, true).toArray(),
      db.programaciones.where('fecha').between(hoy, fin, true, true).toArray(),
      db.asistencias.where('fecha').equals(hoy).toArray(),
    ])
    const mapa = new Map(voluntarios.map((v) => [v.id, v]))
    const progsHoy = progs.filter((p) => p.fecha === hoy)
    const asistenciaHoy = (['M', 'T'] as Jornada[]).map((j) => ({
      jornada: j,
      ...resumenAsistencia(
        filasAsistencia(
          progsHoy.filter((p) => p.jornada === j),
          asistenciasHoy.filter((a) => a.jornada === j),
          mapa,
        ),
      ),
    }))
    return {
      proyecto,
      congregaciones,
      voluntarios: voluntarios.length,
      tareas,
      asistenciaHoy,
      proximos: proximosDias(hoy, proyecto.diasTrabajo, dias, progs),
    }
  }, [hoy])

  if (!datos) {
    return (
      <Pagina titulo="Inicio">
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }
  const { proyecto } = datos
  const hayHoy = datos.asistenciaHoy.some((a) => a.programados > 0 || a.presentes > 0)
  const actual = jornadaActual(proyecto)
  const primerosPasos = [
    { hecho: !!proyecto.nombre.trim(), texto: 'Configure el proyecto (nombre, fechas, días y horarios)', to: '/mas/ajustes' },
    { hecho: datos.congregaciones > 0, texto: 'Agregue las congregaciones', to: '/mas/congregaciones' },
    { hecho: datos.voluntarios > 0, texto: 'Registre voluntarios (uno a uno o con carga masiva)', to: '/mas/carga-masiva' },
    { hecho: datos.tareas > 0, texto: 'Cree las tareas o frentes de trabajo', to: '/mas/tareas' },
  ]
  const pendientes = primerosPasos.filter((p) => !p.hecho)

  return (
    <Pagina titulo={proyecto.nombre.trim() || 'Inicio'}>
      <p className="-mt-3 mb-4 text-sm text-slate-500 dark:text-slate-400">
        <span className="capitalize">{NOMBRES_DIA[diaSemana(hoy)]}</span> {formatoFecha(hoy)} · {datos.voluntarios} voluntarios
      </p>

      <AvisoRespaldo />
      <BotonEmergencia />

      {pendientes.length > 0 && (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <h2 className="mb-2 font-semibold text-primario-700 dark:text-primario-200">Primeros pasos</h2>
          <ul className="space-y-1.5">
            {primerosPasos.map((p) => (
              <li key={p.to}>
                <Link to={p.to} className={`flex items-start gap-2 text-sm ${p.hecho ? 'text-slate-400 line-through' : 'font-medium'}`}>
                  <span>{p.hecho ? '✅' : '⬜'}</span>
                  {p.texto}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Accesos rápidos */}
      <div className="mb-4 grid grid-cols-4 gap-2 text-center text-xs font-medium">
        <Acceso to="/asistencia" icono={<IconoAsistencia className="h-6 w-6" />} texto="Pasar asistencia" />
        <Acceso to="/programacion" icono={<IconoProgramacion className="h-6 w-6" />} texto="Programar" />
        <Acceso to="/voluntarios/nuevo" icono={<IconoMasSimbolo className="h-6 w-6" />} texto="Nuevo voluntario" />
        <Acceso to="/voluntarios" icono={<IconoVoluntarios className="h-6 w-6" />} texto="Buscar" />
      </div>

      {/* Asistencia de hoy */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-primario-700 dark:text-primario-200">Asistencia de hoy</h2>
          <Link to="/asistencia" className="text-sm font-medium text-primario-600 dark:text-primario-300">
            Abrir →
          </Link>
        </div>
        {!hayHoy ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Hoy no hay nadie programado ni asistencia registrada.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {datos.asistenciaHoy.map((a) => (
              <Link
                key={a.jornada}
                to={`/asistencia?f=${hoy}&j=${a.jornada}`}
                className={`rounded-lg p-3 active:opacity-80 ${
                  a.jornada === actual ? 'bg-primario-50 ring-2 ring-primario-300 dark:bg-primario-900/40 dark:ring-primario-700' : 'bg-slate-50 dark:bg-slate-950'
                }`}
              >
                <p className="text-sm font-semibold">{NOMBRE_JORNADA[a.jornada]}</p>
                <p className="text-2xl font-bold tabular-nums">
                  {a.presentes}
                  <span className="text-base font-normal text-slate-500 dark:text-slate-400"> / {a.programados}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  presentes / programados
                  {a.faltan > 0 && <span className="block text-amber-700 dark:text-amber-300">faltan {a.faltan}</span>}
                  {a.noProgramados > 0 && <span className="block">+{a.noProgramados} no programados</span>}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Próximos 7 días */}
      <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <h2 className="mb-2 font-semibold text-primario-700 dark:text-primario-200">Próximos 7 días</h2>
        {datos.proximos.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No hay días de trabajo en los próximos 7 días.{' '}
            <Link to="/mas/ajustes" className="font-medium text-primario-600 dark:text-primario-300">
              Revisar días de trabajo
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {datos.proximos.map((d) => (
              <li key={d.fecha}>
                <Link to={`/programacion?f=${d.fecha}`} className="flex items-center gap-3 py-2.5 active:bg-slate-50 dark:active:bg-slate-800">
                  <div className="w-20 shrink-0">
                    <p className="font-semibold">
                      {d.fecha === hoy ? 'Hoy' : NOMBRES_DIA[diaSemana(d.fecha)].slice(0, 3)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatoFecha(d.fecha).slice(0, 5)}</p>
                  </div>
                  <ChipJornada j="M" datos={d.M} />
                  <ChipJornada j="T" datos={d.T} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Pagina>
  )
}

function Acceso({ to, icono, texto }: { to: string; icono: ReactNode; texto: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1 rounded-xl bg-white px-1 py-3 text-primario-700 shadow-sm active:bg-slate-100 dark:bg-slate-900 dark:text-primario-200 dark:active:bg-slate-800"
    >
      {icono}
      <span className="leading-tight">{texto}</span>
    </Link>
  )
}

function ChipJornada({ j, datos }: { j: Jornada; datos: JornadaPanel }) {
  const estado = estadoJornada(datos)
  if (estado === 'sin_cupo' && datos.programados === 0) {
    return (
      <div className="flex-1 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <span className="font-semibold">{j === 'M' ? 'Mañana' : 'Tarde'}</span>
        <span className="block">sin cupo</span>
      </div>
    )
  }
  const color = {
    sin_cupo: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    faltan: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    completo: 'bg-green-50 text-green-800 dark:bg-green-900/30 dark:text-green-200',
    excedido: 'bg-purple-50 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200',
  }[estado]
  const detalle =
    estado === 'sin_cupo'
      ? 'sin cupo'
      : estado === 'faltan'
        ? `faltan ${datos.faltan}`
        : estado === 'excedido'
          ? `+${-datos.faltan!} sobre cupo`
          : 'completo'
  return (
    <div className={`flex-1 rounded-lg px-2 py-1 text-xs ${color}`}>
      <span className="font-semibold">{j === 'M' ? 'Mañana' : 'Tarde'}</span>{' '}
      <span className="tabular-nums">
        {datos.programados}/{datos.cupo ?? '—'}
      </span>
      <span className="block">{detalle}</span>
    </div>
  )
}
