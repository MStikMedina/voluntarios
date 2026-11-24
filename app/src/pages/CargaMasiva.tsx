import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import { Tarjeta, claseInput } from '../components/Campos'
import { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { entregarArchivo } from '../lib/descargas'
import { leerPrimeraHoja, libroABlob } from '../lib/excel'
import { ordenarCongregaciones } from '../lib/congregaciones'
import { formatoCelular } from '../lib/telefono'
import {
  analizarFilas, congregacionesFaltantes, detectarSeparador, filasPlantilla, importarFilas, NOMBRE_SEPARADOR,
  parsearTexto, resumenFila, type FilaImportada,
} from '../lib/importar'

interface Analisis {
  origen: string
  filas: FilaImportada[]
}

export default function CargaMasiva() {
  const datos = useLiveQuery(async () => ({
    congregaciones: ordenarCongregaciones(await db.congregaciones.toArray()),
    voluntarios: await db.voluntarios.toArray(),
  }))
  const [texto, setTexto] = useState('')
  const [analisis, setAnalisis] = useState<Analisis | null>(null)
  const [crearCong, setCrearCong] = useState(true)
  const [soloProblemas, setSoloProblemas] = useState(false)
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)

  async function descargarPlantilla() {
    setOcupado(true)
    try {
      const { datos: filas, instrucciones } = filasPlantilla((datos?.congregaciones ?? []).map((c) => c.nombre))
      const blob = await libroABlob([
        { nombre: 'Voluntarios', filas },
        { nombre: 'Instrucciones', filas: instrucciones, anchos: [110] },
      ])
      await entregarArchivo(blob, 'plantilla-voluntarios.xlsx', { compartir: false })
    } finally {
      setOcupado(false)
    }
  }

  function analizar(filas: string[][], origen: string) {
    if (!datos) return
    const a = analizarFilas(filas, datos.congregaciones, datos.voluntarios)
    setMensaje(a.filas.length ? null : { tipo: 'error', texto: 'No se encontraron filas con datos.' })
    setAnalisis(a.filas.length ? { origen, filas: a.filas } : null)
    setCrearCong(true)
    setSoloProblemas(false)
  }

  async function elegirArchivo(f: File | undefined) {
    setMensaje(null)
    if (!f) return
    setOcupado(true)
    try {
      const nombre = f.name.toLowerCase()
      if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
        const t = await f.text()
        const sep = detectarSeparador(t)
        analizar(parsearTexto(t, sep), `${f.name} (separador: ${NOMBRE_SEPARADOR[sep]})`)
      } else {
        analizar(await leerPrimeraHoja(await f.arrayBuffer()), f.name)
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo leer el archivo: ${(e as Error).message}` })
    } finally {
      setOcupado(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  function revisarTexto() {
    setMensaje(null)
    const sep = detectarSeparador(texto)
    analizar(parsearTexto(texto, sep), `Texto pegado (separador: ${NOMBRE_SEPARADOR[sep]})`)
  }

  async function importar() {
    if (!analisis) return
    setOcupado(true)
    try {
      const r = await importarFilas(db, analisis.filas, crearCong)
      setAnalisis(null)
      setTexto('')
      setMensaje({
        tipo: 'ok',
        texto:
          `Se importaron ${r.voluntarios} voluntario(s)` +
          (r.congregaciones ? ` y se crearon ${r.congregaciones} congregación(es)` : '') +
          (r.omitidas ? `. Se omitieron ${r.omitidas} fila(s) con problemas.` : '.'),
      })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo importar: ${(e as Error).message}` })
    } finally {
      setOcupado(false)
    }
  }

  const faltantes = analisis ? congregacionesFaltantes(analisis.filas) : []
  const conError = analisis?.filas.filter((f) => f.errores.length) ?? []
  const conAviso = analisis?.filas.filter((f) => !f.errores.length && f.avisos.length) ?? []
  const sinCong = crearCong ? [] : (analisis?.filas.filter((f) => !f.errores.length && f.congregacionNueva) ?? [])
  const aImportar = (analisis?.filas.length ?? 0) - conError.length - sinCong.length
  const visibles = analisis
    ? soloProblemas
      ? analisis.filas.filter((f) => f.errores.length || f.avisos.length || (!crearCong && f.congregacionNueva))
      : analisis.filas
    : []

  return (
    <Pagina titulo="Carga masiva" volver={{ to: '/mas', texto: 'Más' }}>
      <Tarjeta titulo="1. Plantilla">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Descargue la plantilla de Excel, llénela (una fila por voluntario) y luego impórtela aquí. La hoja
          «Instrucciones» explica cada columna.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Disponibilidad con códigos: <code className="font-semibold">LU-M, MI-T, SA-D</code> (LU MA MI JU VI SA DO; M
          mañana, T tarde, D día completo).
        </p>
        <button type="button" disabled={ocupado} onClick={descargarPlantilla} className={`w-full ${claseBotonSecundario}`}>
          Descargar plantilla Excel
        </button>
      </Tarjeta>

      <Tarjeta titulo="2. Importar">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
            Archivo Excel o CSV
          </span>
          <input
            ref={entrada}
            type="file"
            accept=".xlsx,.xls,.csv,.txt,.ods"
            disabled={ocupado || !datos}
            onChange={(e) => elegirArchivo(e.target.files?.[0])}
            className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primario-100 file:px-4 file:py-2.5 file:font-semibold file:text-primario-800 dark:file:bg-primario-900 dark:file:text-primario-100"
          />
        </label>
        <div className="relative py-1 text-center text-xs text-slate-400">o pegue el texto (copiado de Excel o separado por ; o ,)</div>
        <textarea
          aria-label="Texto para importar"
          rows={5}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={'Nombre\tCongregación\tLocal/A-2\t…\nJosé Pérez\tCentral\tLocal\t…'}
          className={`${claseInput} font-mono text-sm`}
        />
        <button
          type="button"
          disabled={!texto.trim() || !datos || ocupado}
          onClick={revisarTexto}
          className={`w-full ${claseBotonSecundario}`}
        >
          Revisar texto pegado
        </button>
      </Tarjeta>

      {mensaje && (
        <div
          role="status"
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
          }`}
        >
          {mensaje.texto}
          {mensaje.tipo === 'ok' && (
            <Link to="/voluntarios" className="ml-1 font-semibold underline">
              Ver voluntarios
            </Link>
          )}
        </div>
      )}

      {analisis && (
        <Tarjeta titulo="3. Vista previa">
          <p className="text-sm text-slate-500 dark:text-slate-400">{analisis.origen}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <Resumen numero={analisis.filas.length} texto="filas" />
            <Resumen numero={conAviso.length} texto="con avisos" color="ambar" />
            <Resumen numero={conError.length} texto="con errores" color="rojo" />
          </div>

          {faltantes.length > 0 && (
            <div className="rounded-lg bg-primario-50 p-3 text-sm dark:bg-primario-900/40">
              <p className="mb-2">
                Estas congregaciones <strong>no existen</strong> en la app: {faltantes.map((f) => `«${f}»`).join(', ')}.
              </p>
              <label className="flex items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={crearCong}
                  onChange={(e) => setCrearCong(e.target.checked)}
                  className="h-5 w-5 accent-primario-600"
                />
                Crearlas al importar
              </label>
              {!crearCong && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  Las {sinCong.length} fila(s) de esas congregaciones no se importarán.
                </p>
              )}
            </div>
          )}

          {(conError.length > 0 || conAviso.length > 0) && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={soloProblemas}
                onChange={(e) => setSoloProblemas(e.target.checked)}
                className="h-4 w-4 accent-primario-600"
              />
              Ver solo las filas con errores o avisos
            </label>
          )}

          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {visibles.map((f) => (
              <FilaVista key={f.fila} f={f} congregaciones={datos?.congregaciones ?? []} omitida={!crearCong && !!f.congregacionNueva} />
            ))}
          </ul>

          {conError.length > 0 && (
            <p className="text-sm text-red-700 dark:text-red-300">
              Las filas con errores no se importan. Corríjalas en el archivo y vuelva a cargarlo, o importe las demás ahora.
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => setAnalisis(null)} className={`flex-1 ${claseBotonSecundario}`}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={ocupado || aImportar <= 0}
              onClick={importar}
              className={`flex-1 ${claseBotonPrimario}`}
            >
              Importar {aImportar} voluntario{aImportar === 1 ? '' : 's'}
            </button>
          </div>
        </Tarjeta>
      )}
    </Pagina>
  )
}

function Resumen({ numero, texto, color }: { numero: number; texto: string; color?: 'ambar' | 'rojo' }) {
  const c =
    color === 'rojo' && numero
      ? 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
      : color === 'ambar' && numero
        ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
        : 'bg-slate-100 dark:bg-slate-800'
  return (
    <div className={`rounded-lg px-2 py-2 ${c}`}>
      <p className="text-xl font-bold tabular-nums">{numero}</p>
      <p>{texto}</p>
    </div>
  )
}

function FilaVista({
  f,
  congregaciones,
  omitida,
}: {
  f: FilaImportada
  congregaciones: { id: number; nombre: string }[]
  omitida: boolean
}) {
  const cong =
    f.congregacionNueva ??
    (f.datos.congregacionId != null ? congregaciones.find((c) => c.id === f.datos.congregacionId)?.nombre : undefined) ??
    (f.datos.invitado ? 'Invitado' : '—')
  const borde = f.errores.length
    ? 'border-red-400 dark:border-red-700'
    : omitida
      ? 'border-slate-300 opacity-60 dark:border-slate-700'
      : f.avisos.length
        ? 'border-amber-400 dark:border-amber-700'
        : 'border-green-400 dark:border-green-800'
  const principal = f.datos.celulares[0]?.numero
  return (
    <li className={`rounded-lg border-l-4 bg-slate-50 px-3 py-2 text-sm dark:bg-slate-950 ${borde}`}>
      <p>
        <span className="mr-1 text-xs text-slate-400">Fila {f.fila}</span>
        <span className="font-semibold">{f.datos.nombre || '(sin nombre)'}</span>
        <span className="text-slate-500 dark:text-slate-400">
          {' '}
          · {cong}
          {f.congregacionNueva ? ' (nueva)' : ''} · {f.datos.tipo}
        </span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {[resumenFila(f), principal ? formatoCelular(principal) : ''].filter(Boolean).join(' · ')}
      </p>
      {f.errores.map((e) => (
        <p key={e} className="text-red-700 dark:text-red-300">
          ✖ {e}
        </p>
      ))}
      {f.avisos.map((a) => (
        <p key={a} className="text-amber-700 dark:text-amber-300">
          ⚠ {a}
        </p>
      ))}
    </li>
  )
}
