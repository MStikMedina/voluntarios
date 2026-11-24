import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { sincronizador } from '../sinc'
import type { EstadoNube as Estado, InfoNube } from '../sinc/motor'
import { useNube } from '../sinc/useNube'
import { NOMBRES_TABLA } from '../lib/respaldo'
import { fechaHora } from '../lib/fechas'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from './Dialogo'

const TEXTO: Record<Estado, { texto: string; color: string }> = {
  apagada: { texto: 'Sin conectar', color: 'bg-slate-400' },
  sincronizando: { texto: 'Sincronizando…', color: 'bg-sky-500 animate-pulse' },
  al_dia: { texto: 'Al día', color: 'bg-green-500' },
  sin_conexion: { texto: 'Sin internet (se guarda aquí y se sube al volver)', color: 'bg-amber-500' },
  error: { texto: 'Error al sincronizar', color: 'bg-red-500' },
  decidir: { texto: 'Falta elegir qué datos conservar', color: 'bg-amber-500' },
}

// Tarjeta en "Más": estado de la sincronización con la nube.
export default function EstadoNube() {
  const info = useNube()
  const pendientes = useLiveQuery(() => db.pendientes.count(), [], 0)
  const e = TEXTO[info.estado]

  return (
    <section className="mt-6 rounded-xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <h2 className="mb-3 font-semibold text-primario-700 dark:text-primario-200">Nube</h2>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Los datos se guardan en este dispositivo y se copian a la nube, así todos los dispositivos ven lo mismo.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-500 dark:text-slate-400">Estado</dt>
        <dd className="flex items-center gap-2">
          <span className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${e.color}`} aria-hidden />
          {e.texto}
        </dd>
        <dt className="text-slate-500 dark:text-slate-400">Última vez</dt>
        <dd>{fechaHora(info.ultima)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Por subir</dt>
        <dd>{pendientes === 0 ? 'Nada' : `${pendientes} cambio${pendientes === 1 ? '' : 's'}`}</dd>
      </dl>
      {info.estado === 'error' && info.error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-200">
          {info.error}
        </p>
      )}
      {info.estado === 'decidir' ? (
        <OpcionesDecidir info={info} />
      ) : (
        info.estado !== 'apagada' && (
          <button
            type="button"
            disabled={info.estado === 'sincronizando'}
            onClick={() => void sincronizador.sincronizar()}
            className={`mt-4 w-full ${claseBotonSecundario}`}
          >
            Sincronizar ahora
          </button>
        )
      )}
    </section>
  )
}

/** Explicación y botones para cuando este dispositivo y la nube tienen datos distintos. */
export function OpcionesDecidir({ info }: { info: InfoNube }) {
  const [confirmar, setConfirmar] = useState(false)
  const c = info.comparacion
  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm">
        La nube ya tiene datos y este dispositivo tiene <strong>otros</strong>. Elija con cuáles quedarse:
      </p>
      {c && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 dark:text-slate-400">
              <th className="font-medium"></th>
              <th className="text-right font-medium">En la nube</th>
              <th className="text-right font-medium">Aquí</th>
            </tr>
          </thead>
          <tbody>
            {Object.keys(c.nube).map((t) => (
              <tr key={t} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1">{NOMBRES_TABLA[t as keyof typeof NOMBRES_TABLA] ?? t}</td>
                <td className="text-right tabular-nums">{c.nube[t]}</td>
                <td className="text-right tabular-nums">{c.local[t] ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button type="button" onClick={() => void sincronizador.usarNube()} className={`w-full ${claseBotonPrimario}`}>
        Usar los datos de la nube (recomendado)
      </button>
      <button type="button" onClick={() => setConfirmar(true)} className={`w-full ${claseBotonSecundario}`}>
        Subir los de este dispositivo…
      </button>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Si no está seguro, haga primero un respaldo en Más → Respaldo: así no pierde nada.
      </p>
      <Dialogo
        abierto={confirmar}
        titulo="¿Reemplazar la nube?"
        onCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <button type="button" onClick={() => setConfirmar(false)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmar(false)
                void sincronizador.subirEsteDispositivo()
              }}
              className={claseBotonPeligro}
            >
              Reemplazar
            </button>
          </>
        }
      >
        <p>
          Los datos de la nube se cambiarán por los de este dispositivo, y <strong>todos los demás dispositivos</strong>{' '}
          quedarán igual que este.
        </p>
      </Dialogo>
    </div>
  )
}
