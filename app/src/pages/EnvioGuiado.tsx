import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Jornada } from '../db/tipos'
import Pagina, { Vacio } from '../components/Pagina'
import { claseInput } from '../components/Campos'
import { claseBotonSecundario } from '../components/Dialogo'
import { IconoWhatsapp } from '../components/Iconos'
import { fechaLarga, hoyISO } from '../lib/fechas'
import { mensajeDePlantilla, variablesMensaje } from '../lib/mensajes'
import { fechaValida, NOMBRE_JORNADA, ocupaCupo } from '../lib/programacion'
import { formatoCelular, validarCelular } from '../lib/telefono'
import { celularPrincipal } from '../lib/voluntarios'
import { esAndroid, whatsappHref } from '../lib/whatsapp'
import { normalizar } from '../lib/texto'

// Envío guiado (PLAN.md §2.5): abre WhatsApp con cada programado, en orden, y marca a quién ya se le envió.
export default function EnvioGuiado() {
  const [params] = useSearchParams()
  const fParam = params.get('f')
  const fecha = fechaValida(fParam) ? fParam : hoyISO()
  const jornada: Jornada = params.get('j') === 'T' ? 'T' : 'M'
  const volver = { to: `/programacion?f=${fecha}&j=${jornada}`, texto: 'Programación' }

  const datos = useLiveQuery(async () => {
    const [proyecto, plantillas, progs, tareas] = await Promise.all([
      db.obtenerProyecto(),
      db.plantillas.toArray(),
      db.programaciones.where('[fecha+jornada]').equals([fecha, jornada]).toArray(),
      db.tareas.toArray(),
    ])
    const vols = await db.voluntarios.bulkGet(progs.map((p) => p.voluntarioId))
    const lista = progs
      .map((p, i) => ({ ...p, voluntario: vols[i] }))
      .filter((p) => p.voluntario && ocupaCupo(p))
      .sort((a, b) => normalizar(a.voluntario!.nombre).localeCompare(normalizar(b.voluntario!.nombre), 'es'))
    return { proyecto, plantillas, lista, tareas }
  }, [fecha, jornada])

  const [plantillaId, setPlantillaId] = useState<number | null>(null)
  const [actual, setActual] = useState(0)
  const [soloPendientes, setSoloPendientes] = useState(true)

  if (!datos) {
    return (
      <Pagina titulo="Envío guiado" volver={volver}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }
  const plantilla = datos.plantillas.find((p) => p.id === plantillaId) ?? datos.plantillas[0]
  const lista = soloPendientes ? datos.lista.filter((p) => !p.mensajeEnviado) : datos.lista
  const enviados = datos.lista.filter((p) => p.mensajeEnviado).length
  const i = Math.min(actual, Math.max(0, lista.length - 1))
  const p = lista[i]
  const android = esAndroid()

  const textoPara = (item: (typeof datos.lista)[number]) =>
    plantilla
      ? mensajeDePlantilla(
          plantilla.texto,
          variablesMensaje({
            voluntario: item.voluntario!,
            proyecto: datos.proyecto,
            fecha,
            jornada,
            tarea: datos.tareas.find((t) => t.id === item.tareaId) ?? null,
          }),
        )
      : ''

  const numero = p ? celularPrincipal(p.voluntario!) : ''
  const valido = validarCelular(numero)

  async function marcar(id: number, valor: boolean) {
    await db.programaciones.update(id, { mensajeEnviado: valor })
  }

  return (
    <Pagina titulo="Envío guiado" volver={volver}>
      <p className="-mt-2 mb-3 text-sm text-slate-600 dark:text-slate-300">
        <span className="capitalize">{fechaLarga(fecha)}</span> · {NOMBRE_JORNADA[jornada]} · {enviados} de {datos.lista.length}{' '}
        enviados
      </p>

      <select
        aria-label="Plantilla"
        value={plantilla?.id ?? ''}
        onChange={(e) => setPlantillaId(Number(e.target.value))}
        className={`${claseInput} mb-2`}
      >
        {datos.plantillas.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nombre}
          </option>
        ))}
      </select>
      <label className="mb-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={soloPendientes}
          onChange={(e) => {
            setSoloPendientes(e.target.checked)
            setActual(0)
          }}
          className="h-4 w-4 accent-primario-600"
        />
        Solo a quienes aún no se les envió
      </label>

      {datos.lista.length === 0 ? (
        <Vacio texto="No hay programados (que puedan asistir) en esta fecha y jornada." />
      ) : !p ? (
        <div className="rounded-xl bg-green-50 p-6 text-center text-green-800 dark:bg-green-900/40 dark:text-green-200">
          <p className="text-lg font-semibold">✅ ¡Listo! Ya se envió a todos.</p>
          <button type="button" onClick={() => setSoloPendientes(false)} className="mt-3 text-sm font-medium underline">
            Ver la lista completa
          </button>
        </div>
      ) : (
        <section className="mb-4 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {i + 1} de {lista.length}
          </p>
          <p className="text-xl font-bold">{p.voluntario!.nombre}</p>
          <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
            {valido ? formatoCelular(numero) : numero ? `${numero} (número no válido)` : 'Sin celular'}
            {p.mensajeEnviado && ' · ✉ ya enviado'}
          </p>
          <p className="mb-4 whitespace-pre-wrap rounded-lg bg-green-50 p-3 text-sm dark:bg-green-950/40">{textoPara(p)}</p>
          {valido ? (
            <a
              href={whatsappHref(numero, textoPara(p), android)}
              target={android ? undefined : '_blank'}
              rel="noopener noreferrer"
              onClick={() => {
                void marcar(p.id, true)
                // Al volver de WhatsApp ya está el siguiente.
                if (!soloPendientes) setTimeout(() => setActual(i + 1), 300)
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3.5 text-lg font-semibold text-white active:bg-green-700"
            >
              <IconoWhatsapp className="h-6 w-6" /> Abrir WhatsApp
            </a>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
              No tiene un celular válido. Sáltelo o corrija su ficha.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => setActual(i - 1)}
              className={claseBotonSecundario}
            >
              ← Anterior
            </button>
            <button
              type="button"
              disabled={i >= lista.length - 1}
              onClick={() => setActual(i + 1)}
              className={claseBotonSecundario}
            >
              Saltar →
            </button>
          </div>
        </section>
      )}

      {datos.lista.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl bg-white shadow-sm dark:divide-slate-800 dark:bg-slate-900">
          {datos.lista.map((x) => (
            <li key={x.id} className="flex items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                onClick={() => {
                  setSoloPendientes(false)
                  setActual(datos.lista.indexOf(x))
                }}
                className={`min-w-0 flex-1 truncate text-left ${x.id === p?.id ? 'font-bold text-primario-700 dark:text-primario-200' : ''}`}
              >
                {x.voluntario!.nombre}
              </button>
              <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={x.mensajeEnviado}
                  onChange={(e) => marcar(x.id, e.target.checked)}
                  className="h-5 w-5 accent-green-600"
                  aria-label={`Mensaje enviado a ${x.voluntario!.nombre}`}
                />
                Enviado
              </label>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  )
}
