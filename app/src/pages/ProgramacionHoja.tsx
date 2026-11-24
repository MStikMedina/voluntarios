import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Jornada } from '../db/tipos'
import Pagina from '../components/Pagina'
import Opciones from '../components/Opciones'
import { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { hoyISO } from '../lib/fechas'
import { hojaProgramacion, nombreArchivoHoja, type Hoja } from '../lib/hoja'
import { elementoAPdf, elementoAPng } from '../lib/imagen'
import { entregarArchivo, puedeCompartirArchivos } from '../lib/descargas'
import { fechaValida } from '../lib/programacion'
import { ordenarTareas } from '../lib/tareas'

type Cuales = 'ambas' | Jornada
const ANCHO_HOJA = 600

// Programación como imagen o PDF (PLAN.md §2.8, Fase 12).
export default function ProgramacionHoja() {
  const [params] = useSearchParams()
  const fParam = params.get('f')
  const fecha = fechaValida(fParam) ? fParam : hoyISO()
  const jParam = params.get('j')
  const [cuales, setCuales] = useState<Cuales>(jParam === 'M' || jParam === 'T' ? jParam : 'ambas')
  const [celulares, setCelulares] = useState(true)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)
  const hojaRef = useRef<HTMLDivElement>(null)
  const volver = { to: `/programacion?f=${fecha}${jParam === 'T' ? '&j=T' : ''}`, texto: 'Programación' }

  const hoja = useLiveQuery(async () => {
    const [proyecto, dia, progs, tareas] = await Promise.all([
      db.obtenerProyecto(),
      db.dias.get(fecha),
      db.programaciones.where('fecha').equals(fecha).toArray(),
      db.tareas.toArray(),
    ])
    const vols = await db.voluntarios.bulkGet([...new Set(progs.map((p) => p.voluntarioId))])
    return hojaProgramacion({
      proyecto,
      fecha,
      dia,
      jornadas: cuales === 'ambas' ? ['M', 'T'] : [cuales],
      programaciones: progs,
      voluntarios: new Map(vols.filter((v) => !!v).map((v) => [v!.id, v!])),
      tareas: ordenarTareas(tareas),
    })
  }, [fecha, cuales])

  const compartible = puedeCompartirArchivos()
  const escala = Math.min(1, (Math.min(window.innerWidth, 576) - 32) / ANCHO_HOJA)

  async function generar(tipo: 'png' | 'pdf', compartir: boolean) {
    if (!hojaRef.current) return
    setOcupado(tipo)
    setMensaje(null)
    try {
      const blob = tipo === 'png' ? await elementoAPng(hojaRef.current) : await elementoAPdf(hojaRef.current)
      const nombre = nombreArchivoHoja(fecha, tipo)
      const r = await entregarArchivo(blob, nombre, { compartir, titulo: `Programación ${hoja?.fecha ?? ''}` })
      if (r === 'descargado') setMensaje(`Se descargó «${nombre}».`)
    } catch (e) {
      setMensaje(`No se pudo generar: ${(e as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <Pagina titulo="Imagen o PDF" volver={volver}>
      <div className="mb-3 space-y-2">
        <Opciones<Cuales>
          valor={cuales}
          onCambiar={setCuales}
          opciones={[
            { valor: 'ambas', texto: 'Ambas jornadas' },
            { valor: 'M', texto: 'Mañana' },
            { valor: 'T', texto: 'Tarde' },
          ]}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={celulares} onChange={(e) => setCelulares(e.target.checked)} className="h-4 w-4 accent-primario-600" />
          Mostrar celulares
        </label>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={!!ocupado || !hoja} onClick={() => generar('png', true)} className={claseBotonPrimario}>
          {ocupado === 'png' ? 'Generando…' : compartible ? 'Compartir imagen' : 'Descargar imagen'}
        </button>
        <button type="button" disabled={!!ocupado || !hoja} onClick={() => generar('pdf', true)} className={claseBotonPrimario}>
          {ocupado === 'pdf' ? 'Generando…' : compartible ? 'Compartir PDF' : 'Descargar PDF'}
        </button>
        {compartible && (
          <>
            <button type="button" disabled={!!ocupado} onClick={() => generar('png', false)} className={claseBotonSecundario}>
              Solo descargar PNG
            </button>
            <button type="button" disabled={!!ocupado} onClick={() => generar('pdf', false)} className={claseBotonSecundario}>
              Solo descargar PDF
            </button>
          </>
        )}
      </div>
      {mensaje && <p className="mb-3 text-center text-sm text-slate-600 dark:text-slate-300">{mensaje}</p>}

      {/* La hoja siempre mide 600 px de ancho (igual en el celular y en el PC); la vista previa se reduce. */}
      <div className="overflow-hidden rounded-xl shadow-sm" style={{ zoom: escala }}>
        {hoja ? <HojaVista ref={hojaRef} hoja={hoja} celulares={celulares} /> : <p className="p-4 text-slate-500">Cargando…</p>}
      </div>
    </Pagina>
  )
}

// Siempre en colores claros (es lo que se comparte), sin depender del modo oscuro.
function HojaVista({ hoja, celulares, ref }: { hoja: Hoja; celulares: boolean; ref: React.Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      className="bg-white p-6 text-[#0f172a]"
      style={{ width: ANCHO_HOJA, fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' }}
    >
      <div className="mb-4 border-b-4 border-[#1e4e8c] pb-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#1e4e8c]">{hoja.proyecto}</p>
        <h2 className="text-2xl font-bold capitalize">Programación {hoja.fecha}</h2>
        {hoja.direccion && <p className="text-sm text-[#475569]">📍 {hoja.direccion}</p>}
        {hoja.encargado && <p className="text-sm text-[#475569]">Encargado: {hoja.encargado}</p>}
      </div>
      {hoja.jornadas.map((j) => (
        <section data-corte key={j.jornada} className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-[#1e4e8c] px-3 py-2 text-white">
            <h3 className="text-lg font-bold">
              {j.titulo} <span className="whitespace-nowrap text-sm font-normal">({j.horario})</span>
            </h3>
            <span className="whitespace-nowrap text-sm font-semibold">
              {j.total} {j.total === 1 ? 'persona' : 'personas'}
              {j.cupo !== null ? ` / cupo ${j.cupo}` : ''}
            </span>
          </div>
          {j.grupos.length === 0 ? (
            <p className="px-3 text-sm italic text-[#64748b]">Nadie programado.</p>
          ) : (
            j.grupos.map((g, k) => (
              // El título de la primera tarea no se separa del título de la jornada.
              <div key={g.tarea} className="mb-3" data-corte={k > 0 ? '' : undefined}>
                <p className="mb-1 border-b border-[#cbd5e1] px-1 pb-0.5 font-semibold text-[#1e4e8c]">
                  {g.tarea} <span className="font-normal text-[#64748b]">({g.personas.length})</span>
                </p>
                <table className="w-full text-sm">
                  <tbody>
                    {g.personas.map((p, i) => (
                      <tr data-corte={i > 0 ? '' : undefined} key={`${p.nombre}-${i}`} className={i % 2 ? 'bg-[#f1f5f9]' : ''}>
                        <td className="w-6 px-1 py-1 text-right text-[#94a3b8]">{i + 1}.</td>
                        <td className="px-2 py-1">
                          {p.nombre}
                          {p.confirmado && <span className="ml-1 text-[#16a34a]">✔</span>}
                        </td>
                        {celulares && <td className="whitespace-nowrap px-2 py-1 text-right tabular-nums text-[#334155]">{p.celular}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </section>
      ))}
      <p data-corte className="text-right text-xs text-[#94a3b8]">✔ = confirmado · Generado con la app Voluntarios</p>
    </div>
  )
}
