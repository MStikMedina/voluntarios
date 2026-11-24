import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Voluntario } from '../db/tipos'
import { claseInput, Tarjeta } from './Campos'
import { IconoWhatsapp } from './Iconos'
import { fechaLarga, hoyISO } from '../lib/fechas'
import { mensajeDePlantilla, variablesMensaje } from '../lib/mensajes'
import { NOMBRE_JORNADA } from '../lib/programacion'
import { validarCelular } from '../lib/telefono'
import { celularPrincipal } from '../lib/voluntarios'
import { esAndroid, whatsappHref } from '../lib/whatsapp'

// Envío individual desde la ficha: plantilla + datos de su próxima programación (si tiene).
export default function EnviarMensaje({ voluntario }: { voluntario: Voluntario }) {
  const datos = useLiveQuery(async () => {
    const [plantillas, proyecto, progs] = await Promise.all([
      db.plantillas.toArray(),
      db.obtenerProyecto(),
      db.programaciones.where('voluntarioId').equals(voluntario.id).toArray(),
    ])
    const hoy = hoyISO()
    const proxima = progs
      .filter((p) => p.fecha >= hoy && p.confirmacion !== 'no_puede')
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.jornada.localeCompare(b.jornada))[0]
    const tarea = proxima?.tareaId != null ? await db.tareas.get(proxima.tareaId) : undefined
    return { plantillas, proyecto, proxima, tarea }
  }, [voluntario.id])
  const [plantillaId, setPlantillaId] = useState<number | null>(null)
  const [editado, setEditado] = useState<string | null>(null)

  const numero = celularPrincipal(voluntario)
  if (!datos || !validarCelular(numero) || datos.plantillas.length === 0) return null
  const plantilla = datos.plantillas.find((p) => p.id === plantillaId) ?? datos.plantillas[0]
  const vars = variablesMensaje({
    voluntario,
    proyecto: datos.proyecto,
    fecha: datos.proxima?.fecha,
    jornada: datos.proxima?.jornada,
    tarea: datos.tarea ?? null,
  })
  const texto = editado ?? mensajeDePlantilla(plantilla.texto, vars)
  const android = esAndroid()

  return (
    <Tarjeta titulo="Enviar mensaje por WhatsApp">
      <select
        aria-label="Plantilla"
        value={plantilla.id}
        onChange={(e) => {
          setPlantillaId(Number(e.target.value))
          setEditado(null)
        }}
        className={claseInput}
      >
        {datos.plantillas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {datos.proxima
          ? `Con su próxima programación: ${fechaLarga(datos.proxima.fecha)}, ${NOMBRE_JORNADA[datos.proxima.jornada].toLowerCase()}.`
          : 'No tiene programación próxima: revise la fecha y la jornada en el texto.'}
      </p>
      <textarea
        aria-label="Mensaje"
        rows={4}
        value={texto}
        onChange={(e) => setEditado(e.target.value)}
        className={`${claseInput} text-sm`}
      />
      <a
        href={whatsappHref(numero, texto, android)}
        target={android ? undefined : '_blank'}
        rel="noopener noreferrer"
        onClick={() => {
          if (datos.proxima) void db.programaciones.update(datos.proxima.id, { mensajeEnviado: true })
        }}
        className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white active:bg-green-700"
      >
        <IconoWhatsapp className="h-5 w-5" /> Enviar por WhatsApp
      </a>
    </Tarjeta>
  )
}
