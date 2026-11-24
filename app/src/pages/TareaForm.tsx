import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { EstadoTarea } from '../db/tipos'
import Pagina from '../components/Pagina'
import { Campo, Tarjeta, claseInput } from '../components/Campos'
import Opciones from '../components/Opciones'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import {
  coincideHabilidad, eliminarTarea, ESTADOS, formATarea, formTareaVacio, guardarTarea, tareaAForm, validarTarea,
  type FormTarea,
} from '../lib/tareas'
import { ordenarVoluntarios } from '../lib/voluntarios'

const VOLVER = { to: '/mas/tareas', texto: 'Tareas' }

export default function TareaForm() {
  const { id: idTexto } = useParams()
  const nueva = idTexto === 'nueva'
  const id = nueva ? undefined : Number(idTexto)
  const navegar = useNavigate()

  const datos = useLiveQuery(async () => {
    const [actual, voluntarios] = await Promise.all([id ? db.tareas.get(id) : undefined, db.voluntarios.toArray()])
    return { actual: actual ?? null, voluntarios: ordenarVoluntarios(voluntarios) }
  }, [id])

  const [form, setForm] = useState<FormTarea | null>(nueva ? formTareaVacio() : null)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmar, setConfirmar] = useState(false)

  if (!nueva && !Number.isInteger(id)) return <Navigate to={VOLVER.to} replace />
  if (datos?.actual && !form) setForm(tareaAForm(datos.actual))

  const titulo = nueva ? 'Nueva tarea' : 'Editar tarea'
  if (!datos || !form) {
    if (datos && !nueva && !datos.actual) return <Navigate to={VOLVER.to} replace />
    return (
      <Pagina titulo={titulo} volver={VOLVER}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const errores = validarTarea(form)
  const visibles = intentado ? errores : {}
  const habituales = id ? datos.voluntarios.filter((v) => v.tareaHabitualId === id) : []
  const conHabilidad = form.habilidadRequerida.trim()
    ? datos.voluntarios.filter((v) => v.tareaHabitualId !== id && coincideHabilidad(v.profesion, form.habilidadRequerida))
    : []

  const cambiar = <K extends keyof FormTarea>(campo: K, valor: FormTarea[K]) =>
    setForm((f) => (f ? { ...f, [campo]: valor } : f))

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (Object.keys(errores).length) return
    setGuardando(true)
    try {
      await guardarTarea(db, formATarea(form!), id)
      navegar(VOLVER.to)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    await eliminarTarea(db, id!)
    navegar(VOLVER.to, { replace: true })
  }

  return (
    <Pagina titulo={titulo} volver={VOLVER}>
      <form onSubmit={enviar} noValidate className="pb-4">
        <Tarjeta titulo="Datos de la tarea">
          <Campo
            etiqueta="Nombre *"
            placeholder="Ej.: Pintura del auditorio"
            value={form.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={visibles.nombre}
            autoFocus={nueva}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Descripción</span>
            <textarea
              rows={2}
              value={form.descripcion}
              onChange={(e) => cambiar('descripcion', e.target.value)}
              className={claseInput}
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Estado</span>
            <Opciones<EstadoTarea> valor={form.estado} onCambiar={(v) => cambiar('estado', v)} opciones={ESTADOS} etiqueta="Estado" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo
              etiqueta="Inicio"
              type="date"
              value={form.fechaInicio}
              onChange={(e) => cambiar('fechaInicio', e.target.value)}
            />
            <Campo
              etiqueta="Fin"
              type="date"
              min={form.fechaInicio || undefined}
              value={form.fechaFin}
              onChange={(e) => cambiar('fechaFin', e.target.value)}
              error={visibles.fechaFin}
            />
          </div>
          <Campo
            etiqueta="Personas necesarias"
            type="number"
            inputMode="numeric"
            min={0}
            value={form.personasNecesarias}
            onChange={(e) => cambiar('personasNecesarias', e.target.value)}
            error={visibles.personasNecesarias}
            ayuda="Es el cupo por defecto de la tarea en cada jornada (se puede ajustar por fecha en Programación)."
          />
          <Campo
            etiqueta="Habilidad requerida"
            placeholder="Ej.: pintura, electricidad"
            value={form.habilidadRequerida}
            onChange={(e) => cambiar('habilidadRequerida', e.target.value)}
            ayuda="Al programar, se sugieren primero los voluntarios cuya profesión coincide."
          />
        </Tarjeta>

        {intentado && Object.keys(errores).length > 0 && (
          <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">Revise los campos en rojo.</p>
        )}
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => navegar(VOLVER.to)} className={`flex-1 ${claseBotonSecundario}`}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={`flex-1 ${claseBotonPrimario}`}>
            Guardar
          </button>
        </div>
      </form>

      {!nueva && (
        <Tarjeta titulo={`Tarea habitual de (${habituales.length})`}>
          {habituales.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nadie la tiene como tarea habitual. Se asigna en el formulario de cada voluntario.
            </p>
          ) : (
            <ListaVoluntarios lista={habituales} />
          )}
        </Tarjeta>
      )}

      {conHabilidad.length > 0 && (
        <Tarjeta titulo={`Con la habilidad «${form.habilidadRequerida.trim()}» (${conHabilidad.length})`}>
          <ListaVoluntarios lista={conHabilidad} />
        </Tarjeta>
      )}

      {!nueva && (
        <button type="button" onClick={() => setConfirmar(true)} className={`mb-4 w-full ${claseBotonPeligro}`}>
          Eliminar tarea
        </button>
      )}

      <Dialogo
        abierto={confirmar}
        titulo="¿Eliminar tarea?"
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
        Se borrará «{form.nombre}». Los voluntarios que la tienen como habitual y la programación quedarán sin tarea; en la
        asistencia se conserva el nombre. No se puede deshacer.
      </Dialogo>
    </Pagina>
  )
}

function ListaVoluntarios({ lista }: { lista: { id: number; nombre: string; profesion: string }[] }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {lista.map((v) => (
        <li key={v.id}>
          <Link to={`/voluntarios/${v.id}`} className="block py-2 active:bg-slate-100 dark:active:bg-slate-800">
            <span className="font-medium">{v.nombre}</span>
            {v.profesion && <span className="text-sm text-slate-500 dark:text-slate-400"> · {v.profesion}</span>}
          </Link>
        </li>
      ))}
    </ul>
  )
}
