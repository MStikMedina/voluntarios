import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { solicitarPersistencia, type EstadoPersistencia } from '../db/persistencia'
import { borrarDatosDePrueba, crearDatosDePrueba, NOMBRE_CONGREGACION_PRUEBA } from '../db/datosPrueba'
import { aISO, alertaEdad, edad, formatoFecha, formatoHora, horaActual } from '../lib/fechas'
import { codigosDisponibilidad } from '../lib/disponibilidad'

const TEXTO_PERSISTENCIA: Record<EstadoPersistencia, string> = {
  persistente: 'Protegidos (el navegador no los borrará solo)',
  no_persistente: 'Sin protección permanente (instale la app y haga respaldos)',
  no_soportado: 'El navegador no permite protegerlos',
}

function fechaHora(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${formatoFecha(aISO(d))} ${formatoHora(horaActual(d))}`
}

// Tarjeta en "Más": estado de los datos guardados en el dispositivo y datos de prueba.
export default function EstadoDatos() {
  const [persistencia, setPersistencia] = useState<EstadoPersistencia | null>(null)
  const [ocupado, setOcupado] = useState(false)

  useEffect(() => {
    solicitarPersistencia().then(setPersistencia)
  }, [])

  const datos = useLiveQuery(async () => {
    const [proyecto, congregaciones, voluntarios, plantillas, prueba] = await Promise.all([
      db.obtenerProyecto(),
      db.congregaciones.count(),
      db.voluntarios.count(),
      db.plantillas.count(),
      db.congregaciones.where('nombre').equals(NOMBRE_CONGREGACION_PRUEBA).first(),
    ])
    const deprueba = prueba
      ? await db.voluntarios.where('congregacionId').equals(prueba.id).sortBy('nombreNorm')
      : []
    return { proyecto, congregaciones, voluntarios, plantillas, deprueba }
  })

  async function ejecutar(accion: () => Promise<void>) {
    setOcupado(true)
    try {
      await accion()
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="mb-3 font-semibold text-primario-700 dark:text-primario-200">
        Datos en este dispositivo
      </h2>
      {!datos ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Congregaciones</dt>
            <dd>{datos.congregaciones}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Voluntarios</dt>
            <dd>{datos.voluntarios}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Plantillas</dt>
            <dd>{datos.plantillas}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Último cambio</dt>
            <dd>{fechaHora(datos.proyecto.ultimoCambio)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Protección</dt>
            <dd>{persistencia ? TEXTO_PERSISTENCIA[persistencia] : '…'}</dd>
          </dl>

          {datos.deprueba.length > 0 && (
            <ul className="mt-3 space-y-1 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
              {datos.deprueba.map((v) => {
                const e = edad(v.fechaNacimiento)
                const alerta = alertaEdad(e, datos.proyecto)
                return (
                  <li key={v.id}>
                    <span className="font-medium">{v.nombre}</span> · {v.profesion} · {e} años
                    {alerta && (
                      <span className="ml-1 rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                        {alerta === 'menor' ? 'Menor' : 'Mayor'}
                      </span>
                    )}
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {codigosDisponibilidad(v.disponibilidad)}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => ejecutar(crearDatosDePrueba)}
              className="flex-1 rounded-lg bg-primario-600 px-3 py-2 text-sm font-medium text-white active:bg-primario-700 disabled:opacity-50"
            >
              Crear datos de prueba
            </button>
            <button
              type="button"
              disabled={ocupado || datos.deprueba.length === 0}
              onClick={() => ejecutar(borrarDatosDePrueba)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium active:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:active:bg-slate-800"
            >
              Borrar datos de prueba
            </button>
          </div>
        </>
      )}
    </section>
  )
}
