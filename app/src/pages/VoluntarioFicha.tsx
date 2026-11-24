import { useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import { Tarjeta } from '../components/Campos'
import TelefonoAcciones from '../components/TelefonoAcciones'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import SelectorDisponibilidad from '../components/SelectorDisponibilidad'
import Edad from '../components/Edad'
import { formatoFecha } from '../lib/fechas'
import { eliminarVoluntario } from '../lib/voluntarios'
import { rutaListaVoluntarios } from '../lib/filtros'

const volverLista = () => ({ to: rutaListaVoluntarios(), texto: 'Voluntarios' })

export default function VoluntarioFicha() {
  const { id: idTexto } = useParams()
  const id = Number(idTexto)
  const navegar = useNavigate()
  const [confirmar, setConfirmar] = useState(false)

  const datos = useLiveQuery(async () => {
    if (!Number.isInteger(id)) return null
    const v = await db.voluntarios.get(id)
    if (!v) return { v: null } as const
    const [proyecto, congregacion, tarea] = await Promise.all([
      db.obtenerProyecto(),
      v.congregacionId != null ? db.congregaciones.get(v.congregacionId) : undefined,
      v.tareaHabitualId != null ? db.tareas.get(v.tareaHabitualId) : undefined,
    ])
    return { v, proyecto, congregacion, tarea }
  }, [id])

  if (!Number.isInteger(id) || datos === null) return <Navigate to="/voluntarios" replace />
  if (!datos) {
    return (
      <Pagina titulo="Voluntario" volver={volverLista()}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }
  if (!datos.v) return <Navigate to="/voluntarios" replace />

  const { v, proyecto, congregacion, tarea } = datos
  const limites = { edadMenor: proyecto.edadMenor, edadMayor: proyecto.edadMayor }
  // Principal primero.
  const celulares = [...v.celulares].sort((a, b) => Number(b.principal) - Number(a.principal))

  async function eliminar() {
    await eliminarVoluntario(db, id)
    navegar(rutaListaVoluntarios(), { replace: true })
  }

  return (
    <Pagina titulo={v.nombre} volver={volverLista()}>
      <div className="-mt-2 mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Insignia>{congregacion?.nombre ?? (v.invitado ? 'Otra congregación' : 'Sin congregación')}</Insignia>
        <Insignia>{v.tipo}</Insignia>
        {v.invitado && <Insignia color="ambar">Invitado puntual</Insignia>}
        {v.fechaNacimiento && <Edad fechaNacimiento={v.fechaNacimiento} limites={limites} />}
      </div>

      <Link
        to={`/voluntarios/${id}/editar`}
        className={`mb-4 block text-center ${claseBotonPrimario}`}
      >
        Editar
      </Link>

      <Tarjeta titulo="Celulares">
        {celulares.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400">Sin celular registrado.</p>
        ) : (
          celulares.map((c) => (
            <TelefonoAcciones
              key={c.numero}
              numero={c.numero}
              etiqueta={celulares.length > 1 ? (c.principal ? '★ Principal' : 'Otro') : undefined}
            />
          ))
        )}
      </Tarjeta>

      <Tarjeta titulo="Contacto de emergencia">
        {v.emergenciaNombre || v.emergenciaCelular ? (
          v.emergenciaCelular ? (
            <TelefonoAcciones numero={v.emergenciaCelular} etiqueta={v.emergenciaNombre || 'Contacto de emergencia'} />
          ) : (
            <p>{v.emergenciaNombre} <span className="text-sm text-slate-500">(sin celular)</span></p>
          )
        ) : (
          <p className="text-slate-500 dark:text-slate-400">No registrado.</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Datos">
        <dl className="space-y-2">
          <Dato titulo="Fecha de nacimiento">{formatoFecha(v.fechaNacimiento) || '—'}</Dato>
          <Dato titulo="Profesión o habilidad">{v.profesion || '—'}</Dato>
          {tarea && <Dato titulo="Tarea habitual">{tarea.nombre}</Dato>}
          {v.invitado && (
            <>
              <Dato titulo="Motivo de la invitación">{v.invitadoMotivo || '—'}</Dato>
              <Dato titulo="Invitado por">{v.invitadoPor || '—'}</Dato>
            </>
          )}
          {v.observaciones && (
            <Dato titulo="Observaciones">
              <span className="whitespace-pre-line">{v.observaciones}</span>
            </Dato>
          )}
        </dl>
      </Tarjeta>

      <Tarjeta titulo="Días disponibles">
        <SelectorDisponibilidad valor={v.disponibilidad} />
      </Tarjeta>

      {congregacion && (congregacion.coordinadorCelular || congregacion.otroContactoCelular) && (
        <Tarjeta titulo={`Congregación ${congregacion.nombre}`}>
          <TelefonoAcciones
            numero={congregacion.coordinadorCelular}
            etiqueta={`Coordinador${congregacion.coordinadorNombre ? `: ${congregacion.coordinadorNombre}` : ''}`}
          />
          <TelefonoAcciones
            numero={congregacion.otroContactoCelular}
            etiqueta={`Otro contacto${congregacion.otroContactoNombre ? `: ${congregacion.otroContactoNombre}` : ''}`}
          />
        </Tarjeta>
      )}

      <button type="button" onClick={() => setConfirmar(true)} className={`mb-4 w-full ${claseBotonPeligro}`}>
        Eliminar voluntario
      </button>

      <Dialogo
        abierto={confirmar}
        titulo="¿Eliminar voluntario?"
        onCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <button type="button" onClick={() => setConfirmar(false)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={eliminar} className={claseBotonPeligro}>
              Eliminar
            </button>
          </>
        }
      >
        Se borrará a «{v.nombre}» definitivamente, junto con su programación y su asistencia. No se puede deshacer.
      </Dialogo>
    </Pagina>
  )
}

function Dato({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-slate-500 dark:text-slate-400">{titulo}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Insignia({ children, color }: { children: ReactNode; color?: 'ambar' }) {
  const clase =
    color === 'ambar'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'
      : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  return <span className={`rounded-full px-2.5 py-0.5 font-medium ${clase}`}>{children}</span>
}
