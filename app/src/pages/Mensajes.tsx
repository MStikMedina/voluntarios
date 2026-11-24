import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Jornada } from '../db/tipos'
import Pagina, { Vacio } from '../components/Pagina'
import { Tarjeta, claseInput } from '../components/Campos'
import Opciones from '../components/Opciones'
import { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { IconoFlecha, IconoMasSimbolo } from '../components/Iconos'
import { mensajeDePlantilla, variablesMensaje } from '../lib/mensajes'
import { restaurarPlantillasIniciales } from '../lib/plantillas'
import { fechaInicialProgramacion } from '../lib/programacion'

export default function Mensajes() {
  const datos = useLiveQuery(async () => ({ plantillas: await db.plantillas.toArray(), proyecto: await db.obtenerProyecto() }))
  const [fecha, setFecha] = useState<string | null>(null)
  const [jornada, setJornada] = useState<Jornada>('M')
  const [aviso, setAviso] = useState<string | null>(null)

  if (!datos) {
    return (
      <Pagina titulo="Mensajes" volver={{ to: '/mas', texto: 'Más' }}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }
  const f = fecha ?? fechaInicialProgramacion(datos.proyecto.diasTrabajo)
  const ejemplo = variablesMensaje({
    voluntario: { nombre: 'José Pérez' },
    proyecto: datos.proyecto,
    fecha: f,
    jornada: 'M',
    tarea: { nombre: 'Pintura' },
  })

  return (
    <Pagina titulo="Mensajes" volver={{ to: '/mas', texto: 'Más' }}>
      <Tarjeta titulo="Envío guiado por WhatsApp">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Envía un mensaje a cada programado de una fecha y jornada, uno por uno, marcando a quién ya se le envió.
        </p>
        <input type="date" aria-label="Fecha" value={f} onChange={(e) => setFecha(e.target.value)} className={claseInput} />
        <Opciones<Jornada>
          valor={jornada}
          onCambiar={setJornada}
          opciones={[
            { valor: 'M', texto: 'Mañana' },
            { valor: 'T', texto: 'Tarde' },
          ]}
        />
        <Link to={`/programacion/enviar?f=${f}&j=${jornada}`} className={`block text-center ${claseBotonPrimario}`}>
          Empezar envío guiado
        </Link>
      </Tarjeta>

      <h2 className="mb-2 mt-6 font-semibold text-primario-700 dark:text-primario-200">Plantillas</h2>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        Variables: {'{nombre} {fecha} {jornada} {hora} {tarea} {proyecto}'} — se reemplazan al enviar.
      </p>
      <Link
        to="/mas/mensajes/nueva"
        className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-primario-600 px-4 py-3 font-semibold text-white active:bg-primario-700"
      >
        <IconoMasSimbolo className="h-5 w-5" /> Nueva plantilla
      </Link>
      {datos.plantillas.length === 0 ? (
        <Vacio texto="No hay plantillas." />
      ) : (
        <ul className="space-y-2">
          {datos.plantillas.map((p) => (
            <li key={p.id}>
              <Link
                to={`/mas/mensajes/${p.id}`}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm active:bg-slate-100 dark:bg-slate-900 dark:active:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.nombre}</p>
                  <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{mensajeDePlantilla(p.texto, ejemplo)}</p>
                </div>
                <IconoFlecha className="h-5 w-5 shrink-0 text-slate-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={async () => {
          const n = await restaurarPlantillasIniciales(db)
          setAviso(n ? `Se agregaron ${n} plantilla(s) inicial(es).` : 'Las 4 plantillas iniciales ya están.')
        }}
        className={`mt-4 w-full ${claseBotonSecundario}`}
      >
        Restaurar plantillas iniciales que falten
      </button>
      {aviso && <p className="mt-2 text-center text-sm text-slate-500">{aviso}</p>}
    </Pagina>
  )
}
