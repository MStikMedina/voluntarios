import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import { Tarjeta } from '../components/Campos'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { fechaHora as fechaHoraISO } from '../lib/fechas'
import { entregarArchivo, puedeCompartirArchivos } from '../lib/descargas'
import {
  borrarDatos, cambiosSinRespaldar, contar, contarBase, crearRespaldo, leerRespaldo, NOMBRES_TABLA, nombreArchivoRespaldo,
  respaldoABlob, restaurarRespaldo, TABLAS, type ModoRestaurar, type Respaldo as TipoRespaldo,
} from '../lib/respaldo'

export default function Respaldo() {
  const datos = useLiveQuery(async () => ({ proyecto: await db.obtenerProyecto(), conteos: await contarBase(db) }))
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [archivo, setArchivo] = useState<{ nombre: string; respaldo: TipoRespaldo } | null>(null)
  const [confirmar, setConfirmar] = useState<ModoRestaurar | null>(null)
  const [borrar, setBorrar] = useState(false)
  const entrada = useRef<HTMLInputElement>(null)
  const compartible = puedeCompartirArchivos()

  async function respaldar(compartir: boolean) {
    setOcupado(true)
    setMensaje(null)
    try {
      const r = await crearRespaldo(db)
      const nombre = nombreArchivoRespaldo()
      const res = await entregarArchivo(respaldoABlob(r), nombre, { compartir, titulo: 'Respaldo Voluntarios' })
      if (res === 'cancelado') {
        setMensaje({ tipo: 'error', texto: 'Se canceló. El respaldo no se guardó.' })
      } else {
        await db.guardarProyecto({ ultimoRespaldo: new Date().toISOString() })
        setMensaje({
          tipo: 'ok',
          texto:
            res === 'compartido'
              ? `Respaldo «${nombre}» compartido. Guárdelo en un lugar seguro (Drive, WhatsApp a usted mismo, PC).`
              : `Respaldo «${nombre}» descargado (carpeta Descargas).`,
        })
      }
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo crear el respaldo: ${(e as Error).message}` })
    } finally {
      setOcupado(false)
    }
  }

  async function elegirArchivo(f: File | undefined) {
    setMensaje(null)
    setArchivo(null)
    if (!f) return
    try {
      const respaldo = leerRespaldo(await f.text())
      setArchivo({ nombre: f.name, respaldo })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: (e as Error).message })
    } finally {
      if (entrada.current) entrada.current.value = ''
    }
  }

  async function restaurar(modo: ModoRestaurar) {
    if (!archivo) return
    setConfirmar(null)
    setOcupado(true)
    try {
      await restaurarRespaldo(db, archivo.respaldo, modo)
      setArchivo(null)
      setMensaje({
        tipo: 'ok',
        texto: modo === 'reemplazar' ? 'Listo: los datos ahora son los del respaldo.' : 'Listo: se combinaron los datos del respaldo.',
      })
    } catch (e) {
      setMensaje({ tipo: 'error', texto: `No se pudo restaurar: ${(e as Error).message}` })
    } finally {
      setOcupado(false)
    }
  }

  const pendiente = datos && cambiosSinRespaldar(datos.proyecto)
  const conteosArchivo = archivo ? contar(archivo.respaldo.datos) : null

  return (
    <Pagina titulo="Respaldo" volver={{ to: '/mas', texto: 'Más' }}>
      <Tarjeta titulo="Crear respaldo">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Guarda <strong>todos</strong> los datos en un archivo. Sirve para no perder nada y para pasar los datos al PC (o
          de vuelta al celular).
        </p>
        {datos && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-slate-500 dark:text-slate-400">Último respaldo</dt>
            <dd>{fechaHoraISO(datos.proyecto.ultimoRespaldo)}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Último cambio</dt>
            <dd>{fechaHoraISO(datos.proyecto.ultimoCambio)}</dd>
          </dl>
        )}
        {pendiente && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
            ⚠ Hay cambios sin respaldar.
          </p>
        )}
        <button type="button" disabled={ocupado} onClick={() => respaldar(true)} className={`w-full ${claseBotonPrimario}`}>
          {compartible ? 'Crear respaldo y compartir' : 'Crear respaldo (descargar)'}
        </button>
        {compartible && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => respaldar(false)}
            className={`w-full ${claseBotonSecundario}`}
          >
            Solo descargar el archivo
          </button>
        )}
      </Tarjeta>

      {mensaje && (
        <p
          role="status"
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            mensaje.tipo === 'ok'
              ? 'bg-green-50 text-green-800 dark:bg-green-900/40 dark:text-green-200'
              : 'bg-red-50 text-red-800 dark:bg-red-900/40 dark:text-red-200'
          }`}
        >
          {mensaje.texto}
        </p>
      )}

      <Tarjeta titulo="Restaurar">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Elija un archivo <code>voluntarios-respaldo-….json</code>. Antes de cambiar nada verá lo que contiene.
        </p>
        <input
          ref={entrada}
          type="file"
          accept=".json,application/json"
          onChange={(e) => elegirArchivo(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primario-100 file:px-4 file:py-2.5 file:font-semibold file:text-primario-800 dark:file:bg-primario-900 dark:file:text-primario-100"
        />

        {archivo && conteosArchivo && datos && (
          <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-sm">
              <strong>{archivo.nombre}</strong>
              <br />
              <span className="text-slate-500 dark:text-slate-400">
                Creado el {fechaHoraISO(archivo.respaldo.creado)}
                {archivo.respaldo.datos.proyecto.nombre ? ` · ${archivo.respaldo.datos.proyecto.nombre}` : ''}
              </span>
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 dark:text-slate-400">
                  <th className="font-medium"></th>
                  <th className="text-right font-medium">En el archivo</th>
                  <th className="text-right font-medium">En este equipo</th>
                </tr>
              </thead>
              <tbody>
                {TABLAS.map((t) => (
                  <tr key={t} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1">{NOMBRES_TABLA[t]}</td>
                    <td className="text-right tabular-nums">{conteosArchivo[t]}</td>
                    <td className="text-right tabular-nums">{datos.conteos[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="space-y-2">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setConfirmar('reemplazar')}
                className={`w-full ${claseBotonPeligro}`}
              >
                Reemplazar todo con el archivo
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setConfirmar('combinar')}
                className={`w-full ${claseBotonSecundario}`}
              >
                Combinar (agregar o actualizar)
              </button>
              <button type="button" onClick={() => setArchivo(null)} className="w-full py-2 text-sm text-slate-500">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Tarjeta>

      <Tarjeta titulo="Empezar de cero">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Úselo al terminar la fase de pruebas, antes de cargar los datos reales. Borra congregaciones, voluntarios,
          tareas, cupos, programación y asistencia <strong>en todos los dispositivos</strong> (también en la nube).{' '}
          <strong>Haga un respaldo antes</strong> si quiere conservar algo.
        </p>
        <button type="button" onClick={() => setBorrar(true)} className={`w-full ${claseBotonPeligro}`}>
          Borrar los datos…
        </button>
      </Tarjeta>

      {borrar && (
        <DialogoBorrar
          onCerrar={() => setBorrar(false)}
          onHecho={(todo) => {
            setBorrar(false)
            setMensaje({
              tipo: 'ok',
              texto: todo ? 'Listo: la app quedó como nueva.' : 'Listo: se borraron los datos (se conservaron Ajustes y plantillas).',
            })
            window.scrollTo({ top: 0, behavior: 'smooth' })
          }}
        />
      )}

      <Dialogo
        abierto={confirmar !== null}
        titulo={confirmar === 'reemplazar' ? '¿Reemplazar todos los datos?' : '¿Combinar los datos?'}
        onCerrar={() => setConfirmar(null)}
        acciones={
          <>
            <button type="button" onClick={() => setConfirmar(null)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => confirmar && restaurar(confirmar)}
              className={confirmar === 'reemplazar' ? claseBotonPeligro : claseBotonPrimario}
            >
              {confirmar === 'reemplazar' ? 'Reemplazar' : 'Combinar'}
            </button>
          </>
        }
      >
        {confirmar === 'reemplazar' ? (
          <p>
            Se <strong>borrarán todos los datos</strong> (en este equipo, en la nube y en los demás dispositivos) y
            quedarán solo los del archivo. Si tiene cambios que no están en el archivo, haga primero un respaldo.
          </p>
        ) : (
          <p>
            Los registros del archivo se agregan, y los que ya existen (mismo id) se reemplazan por la versión del
            archivo. Lo que no está en el archivo se conserva. Los cambios se copian a la nube.
          </p>
        )}
      </Dialogo>
    </Pagina>
  )
}

function DialogoBorrar({ onCerrar, onHecho }: { onCerrar: () => void; onHecho: (todo: boolean) => void }) {
  const [texto, setTexto] = useState('')
  const [todo, setTodo] = useState(false)
  const listo = texto.trim().toUpperCase() === 'BORRAR'
  return (
    <Dialogo
      abierto
      titulo="¿Borrar los datos?"
      onCerrar={onCerrar}
      acciones={
        <>
          <button type="button" onClick={onCerrar} className={claseBotonSecundario}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={!listo}
            onClick={async () => {
              await borrarDatos(db, todo)
              onHecho(todo)
            }}
            className={claseBotonPeligro}
          >
            Borrar
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm">
        Se borrarán definitivamente las congregaciones, voluntarios, tareas, cupos, programación y asistencia en{' '}
        <strong>todos los dispositivos</strong> (también en la nube). No se puede deshacer.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} className="h-4 w-4 accent-red-600" />
        Borrar también Ajustes y plantillas (dejar la app como nueva)
      </label>
      <label className="block text-sm">
        Escriba <strong>BORRAR</strong> para confirmar:
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoCapitalize="characters"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
    </Dialogo>
  )
}
