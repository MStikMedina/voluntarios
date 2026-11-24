import { useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Plantilla } from '../db/tipos'
import Pagina from '../components/Pagina'
import { Campo, MensajeError, Tarjeta, claseInput } from '../components/Campos'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import { mensajeDePlantilla, VARIABLES, variablesMensaje } from '../lib/mensajes'
import { fechaInicialProgramacion } from '../lib/programacion'

const VOLVER = { to: '/mas/mensajes', texto: 'Mensajes' }

export default function PlantillaForm() {
  const { id: idTexto } = useParams()
  const nueva = idTexto === 'nueva'
  const id = nueva ? undefined : Number(idTexto)
  const navegar = useNavigate()
  const datos = useLiveQuery(
    async () => ({ actual: id ? ((await db.plantillas.get(id)) ?? null) : null, proyecto: await db.obtenerProyecto() }),
    [id],
  )
  const [form, setForm] = useState<Omit<Plantilla, 'id'> | null>(nueva ? { nombre: '', texto: 'Hola {nombre}, ' } : null)
  const [intentado, setIntentado] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)

  if (!nueva && !Number.isInteger(id)) return <Navigate to={VOLVER.to} replace />
  if (datos?.actual && !form) setForm({ nombre: datos.actual.nombre, texto: datos.actual.texto })
  const titulo = nueva ? 'Nueva plantilla' : 'Editar plantilla'
  if (!datos || !form) {
    if (datos && !nueva && !datos.actual) return <Navigate to={VOLVER.to} replace />
    return (
      <Pagina titulo={titulo} volver={VOLVER}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const errores = {
    nombre: form.nombre.trim() ? undefined : 'Escriba un nombre.',
    texto: form.texto.trim() ? undefined : 'Escriba el texto del mensaje.',
  }
  const hayErrores = !!(errores.nombre || errores.texto)
  const ejemplo = variablesMensaje({
    voluntario: { nombre: 'José Pérez' },
    proyecto: datos.proyecto,
    fecha: fechaInicialProgramacion(datos.proyecto.diasTrabajo),
    jornada: 'M',
    tarea: { nombre: 'Pintura' },
  })

  function insertar(variable: string) {
    const el = area.current
    const t = `{${variable}}`
    if (!el || !form) return
    const ini = el.selectionStart ?? form.texto.length
    const fin = el.selectionEnd ?? form.texto.length
    const texto = form.texto.slice(0, ini) + t + form.texto.slice(fin)
    setForm({ ...form, texto })
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(ini + t.length, ini + t.length)
    })
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (hayErrores || !form) return
    const datosP = { nombre: form.nombre.replace(/\s+/g, ' ').trim(), texto: form.texto.trim() }
    if (nueva) await db.plantillas.add(datosP as Plantilla)
    else await db.plantillas.update(id!, datosP)
    navegar(VOLVER.to)
  }

  return (
    <Pagina titulo={titulo} volver={VOLVER}>
      <form onSubmit={guardar} noValidate>
        <Tarjeta titulo="Plantilla">
          <Campo
            etiqueta="Nombre *"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            error={intentado ? errores.nombre : undefined}
            autoFocus={nueva}
          />
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Texto *</span>
            <textarea
              ref={area}
              rows={6}
              value={form.texto}
              onChange={(e) => setForm({ ...form, texto: e.target.value })}
              aria-invalid={intentado && !!errores.texto}
              className={claseInput}
            />
            <MensajeError texto={intentado ? errores.texto : undefined} />
          </label>
          <div>
            <p className="mb-1 text-sm text-slate-600 dark:text-slate-300">Insertar variable:</p>
            <div className="flex flex-wrap gap-1.5">
              {VARIABLES.map((v) => (
                <button
                  key={v.clave}
                  type="button"
                  title={v.texto}
                  onClick={() => insertar(v.clave)}
                  className="rounded-full bg-primario-100 px-3 py-1 text-sm font-medium text-primario-800 active:bg-primario-200 dark:bg-primario-900 dark:text-primario-100"
                >
                  {`{${v.clave}}`}
                </button>
              ))}
            </div>
          </div>
        </Tarjeta>
        <Tarjeta titulo="Vista previa (ejemplo)">
          <p className="whitespace-pre-wrap rounded-lg bg-green-50 p-3 text-sm dark:bg-green-950/40">
            {mensajeDePlantilla(form.texto, ejemplo)}
          </p>
        </Tarjeta>
        <div className="mb-4 flex gap-2">
          <button type="button" onClick={() => navegar(VOLVER.to)} className={`flex-1 ${claseBotonSecundario}`}>
            Cancelar
          </button>
          <button type="submit" className={`flex-1 ${claseBotonPrimario}`}>
            Guardar
          </button>
        </div>
      </form>
      {!nueva && (
        <button type="button" onClick={() => setConfirmar(true)} className={`mb-4 w-full ${claseBotonPeligro}`}>
          Eliminar plantilla
        </button>
      )}
      <Dialogo
        abierto={confirmar}
        titulo="¿Eliminar plantilla?"
        onCerrar={() => setConfirmar(false)}
        acciones={
          <>
            <button type="button" onClick={() => setConfirmar(false)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={async () => {
                await db.plantillas.delete(id!)
                navegar(VOLVER.to, { replace: true })
              }}
              className={claseBotonPeligro}
            >
              Eliminar
            </button>
          </>
        }
      >
        Se borrará «{form.nombre}». Las plantillas iniciales se pueden restaurar desde Mensajes.
      </Dialogo>
    </Pagina>
  )
}
