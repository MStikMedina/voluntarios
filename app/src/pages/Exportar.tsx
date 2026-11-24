import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import { Campo, Tarjeta } from '../components/Campos'
import { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { entregarArchivo } from '../lib/descargas'
import { libroABlob, type Hoja } from '../lib/excel'
import { formatoFecha } from '../lib/fechas'
import {
  filasDetalleAsistencia, filasHoras, filasListado, filasPorFecha, filasPorTarea, nombreArchivoExport, type Rango,
} from '../lib/exportar'
import { rutaListaVoluntarios } from '../lib/filtros'

type Reporte = 'listado' | 'horas' | 'tareas' | 'fechas' | 'todo'

const REPORTES: { id: Exclude<Reporte, 'todo'>; titulo: string; detalle: string }[] = [
  { id: 'horas', titulo: 'Horas y jornadas por voluntario', detalle: 'Días, jornadas de mañana y tarde y horas (según el horario de cada jornada).' },
  { id: 'tareas', titulo: 'Por tarea', detalle: 'Jornadas programadas y trabajadas, personas distintas y horas por tarea.' },
  { id: 'fechas', titulo: 'Por fecha', detalle: 'Cupo, programados, confirmados y asistentes por fecha y jornada.' },
  { id: 'listado', titulo: 'Listado de voluntarios', detalle: 'Todos los voluntarios con todos sus datos.' },
]

export default function Exportar() {
  const proyecto = useLiveQuery(() => db.obtenerProyecto())
  const [rango, setRango] = useState<Rango | null>(null)
  const [ocupado, setOcupado] = useState<Reporte | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (!proyecto) {
    return (
      <Pagina titulo="Exportar" volver={{ to: '/mas', texto: 'Más' }}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }
  const r: Rango = rango ?? { desde: proyecto.fechaInicio, hasta: proyecto.fechaFin }
  const textoRango =
    r.desde || r.hasta ? `del ${formatoFecha(r.desde) || 'inicio'} al ${formatoFecha(r.hasta) || 'hoy'}` : 'todas las fechas'

  async function exportar(tipo: Reporte) {
    setOcupado(tipo)
    setMensaje(null)
    try {
      const [voluntarios, congregaciones, tareas, dias, programaciones, asistencias] = await Promise.all([
        db.voluntarios.toArray(),
        db.congregaciones.toArray(),
        db.tareas.toArray(),
        db.dias.toArray(),
        db.programaciones.toArray(),
        db.asistencias.toArray(),
      ])
      const hojas: Record<Exclude<Reporte, 'todo'>, () => Hoja[]> = {
        listado: () => [{ nombre: 'Voluntarios', filas: filasListado(voluntarios, congregaciones, tareas) }],
        horas: () => [
          { nombre: 'Horas por voluntario', filas: filasHoras(asistencias, voluntarios, congregaciones, proyecto!, r) },
          { nombre: 'Detalle asistencia', filas: filasDetalleAsistencia(asistencias, programaciones, voluntarios, tareas, r) },
        ],
        tareas: () => [{ nombre: 'Por tarea', filas: filasPorTarea(tareas, programaciones, asistencias, proyecto!, r) }],
        fechas: () => [{ nombre: 'Por fecha', filas: filasPorFecha(dias, programaciones, asistencias, r) }],
      }
      const lista: Hoja[] =
        tipo === 'todo'
          ? [...hojas.horas().slice(0, 1), ...hojas.tareas(), ...hojas.fechas(), ...hojas.listado(), ...hojas.horas().slice(1)]
          : hojas[tipo]()
      const nombre = nombreArchivoExport(tipo === 'todo' ? 'informe' : tipo)
      const res = await entregarArchivo(await libroABlob(lista), nombre, { compartir: false })
      if (res === 'descargado') setMensaje(`Se descargó «${nombre}».`)
    } catch (e) {
      setMensaje(`No se pudo exportar: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Pagina titulo="Exportar a Excel" volver={{ to: '/mas', texto: 'Más' }}>
      <Tarjeta titulo="Rango de fechas">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Desde" type="date" value={r.desde} onChange={(e) => setRango({ ...r, desde: e.target.value })} />
          <Campo etiqueta="Hasta" type="date" value={r.hasta} onChange={(e) => setRango({ ...r, hasta: e.target.value })} />
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => setRango({ desde: proyecto.fechaInicio, hasta: proyecto.fechaFin })}
            className="font-medium text-primario-600 dark:text-primario-300"
          >
            Fechas del proyecto
          </button>
          <button type="button" onClick={() => setRango({ desde: '', hasta: '' })} className="font-medium text-primario-600 dark:text-primario-300">
            Todas las fechas
          </button>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Se usa para horas, tareas y fechas ({textoRango}). El listado de voluntarios no depende del rango.
        </p>
      </Tarjeta>

      <button type="button" disabled={!!ocupado} onClick={() => exportar('todo')} className={`mb-4 w-full ${claseBotonPrimario}`}>
        {ocupado === 'todo' ? 'Generando…' : 'Informe completo (todas las hojas)'}
      </button>

      <ul className="space-y-2">
        {REPORTES.map((x) => (
          <li key={x.id} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{x.titulo}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{x.detalle}</p>
            </div>
            <button type="button" disabled={!!ocupado} onClick={() => exportar(x.id)} className={`shrink-0 ${claseBotonSecundario}`}>
              {ocupado === x.id ? '…' : 'Excel'}
            </button>
          </li>
        ))}
      </ul>
      {mensaje && <p className="mt-3 text-center text-sm text-slate-600 dark:text-slate-300">{mensaje}</p>}
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Para exportar solo los voluntarios de una búsqueda o filtro, use el botón «Excel» en la{' '}
        <Link to={rutaListaVoluntarios()} className="font-medium text-primario-600 dark:text-primario-300">
          lista de voluntarios
        </Link>
        .
      </p>
    </Pagina>
  )
}
