import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Disponibilidad, TipoVoluntario } from '../db/tipos'
import Pagina from '../components/Pagina'
import { Aviso, Campo, MensajeError, Tarjeta, claseInput } from '../components/Campos'
import Dialogo, { claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import SelectorDisponibilidad from '../components/SelectorDisponibilidad'
import Edad from '../components/Edad'
import { IconoBasura, IconoMasSimbolo } from '../components/Iconos'
import { ordenarCongregaciones } from '../lib/congregaciones'
import { formatoCelular, validarCelular } from '../lib/telefono'
import { hoyISO } from '../lib/fechas'
import {
  asegurarPrincipal, duplicadosVoluntario, formAVoluntario, formVoluntarioVacio, guardarVoluntario,
  hayDuplicados, hayErrores, validarVoluntario, voluntarioAForm, type DuplicadosVoluntario, type FormVoluntario,
} from '../lib/voluntarios'

export default function VoluntarioForm() {
  const { id: idTexto } = useParams()
  const nuevo = idTexto === undefined
  const id = nuevo ? undefined : Number(idTexto)
  const navegar = useNavigate()
  const volver = nuevo ? { to: '/voluntarios', texto: 'Voluntarios' } : { to: `/voluntarios/${id}`, texto: 'Ficha' }

  const datos = useLiveQuery(async () => {
    const [proyecto, congregaciones, todos, actual] = await Promise.all([
      db.obtenerProyecto(),
      db.congregaciones.toArray(),
      db.voluntarios.toArray(),
      id ? db.voluntarios.get(id) : undefined,
    ])
    return { proyecto, congregaciones: ordenarCongregaciones(congregaciones), todos, actual: actual ?? null }
  }, [id])

  const [form, setForm] = useState<FormVoluntario | null>(nuevo ? formVoluntarioVacio() : null)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmarDup, setConfirmarDup] = useState(false)
  const [autoElegida, setAutoElegida] = useState(false)

  if (!nuevo && !Number.isInteger(id)) return <Navigate to="/voluntarios" replace />
  // Carga inicial al editar (ajuste de estado durante el render).
  if (datos?.actual && !form) setForm(voluntarioAForm(datos.actual))
  // Nuevo con una sola congregación: se elige sola.
  if (nuevo && form && datos && !autoElegida) {
    setAutoElegida(true)
    if (datos.congregaciones.length === 1) setForm({ ...form, congregacionId: String(datos.congregaciones[0].id) })
  }

  const titulo = nuevo ? 'Nuevo voluntario' : 'Editar voluntario'
  if (!datos || !form) {
    if (datos && !nuevo && !datos.actual) return <Navigate to="/voluntarios" replace />
    return (
      <Pagina titulo={titulo} volver={volver}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const errores = validarVoluntario(form)
  const visibles = intentado ? errores : {}
  const guardar = formAVoluntario(form)
  const dup = duplicadosVoluntario(guardar, datos.todos, id)
  const limites = { edadMenor: datos.proyecto.edadMenor, edadMayor: datos.proyecto.edadMayor }

  function cambiar<K extends keyof FormVoluntario>(campo: K, valor: FormVoluntario[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
  }

  function cambiarCelular(i: number, numero: string) {
    setForm((f) => (f ? { ...f, celulares: f.celulares.map((c, j) => (j === i ? { ...c, numero } : c)) } : f))
  }
  const marcarPrincipal = (i: number) =>
    setForm((f) => (f ? { ...f, celulares: f.celulares.map((c, j) => ({ ...c, principal: j === i })) } : f))
  const agregarCelular = () =>
    setForm((f) => (f ? { ...f, celulares: [...f.celulares, { numero: '', principal: false }] } : f))
  const quitarCelular = (i: number) =>
    setForm((f) => {
      if (!f) return f
      const resto = f.celulares.filter((_, j) => j !== i)
      return { ...f, celulares: resto.length ? asegurarPrincipal(resto) : [{ numero: '', principal: true }] }
    })

  async function grabar() {
    setGuardando(true)
    try {
      const nuevoId = await guardarVoluntario(db, guardar, id)
      navegar(`/voluntarios/${nuevoId}`, { replace: true })
    } finally {
      setGuardando(false)
    }
  }

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (hayErrores(errores)) {
      setTimeout(
        () => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        0,
      )
      return
    }
    if (hayDuplicados(dup)) setConfirmarDup(true)
    else void grabar()
  }

  return (
    <Pagina titulo={titulo} volver={volver}>
      <form onSubmit={enviar} noValidate className="pb-4">
        <Tarjeta titulo="Datos personales">
          <Campo
            etiqueta="Nombre completo *"
            value={form.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={visibles.nombre}
            autoFocus={nuevo}
            autoCapitalize="words"
          />
          {dup.nombre.length > 0 && <Aviso>{textoDupNombre(dup)}</Aviso>}

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Congregación{form.invitado ? '' : ' *'}
            </span>
            <select
              value={form.congregacionId}
              onChange={(e) => cambiar('congregacionId', e.target.value)}
              aria-invalid={!!visibles.congregacionId}
              className={`${claseInput} ${visibles.congregacionId ? 'border-red-500 dark:border-red-500' : ''}`}
            >
              <option value="">{form.invitado ? '— Otra / sin congregación —' : 'Elija…'}</option>
              {datos.congregaciones.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.numero ? ` (${c.numero})` : ''}
                </option>
              ))}
            </select>
            <MensajeError texto={visibles.congregacionId} />
          </label>
          {datos.congregaciones.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Aún no hay congregaciones.{' '}
              <Link to="/mas/congregaciones/nueva" className="font-medium text-primario-600 dark:text-primario-300">
                Crear una
              </Link>
            </p>
          )}

          <label className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              checked={form.invitado}
              onChange={(e) => cambiar('invitado', e.target.checked)}
              className="h-5 w-5 accent-primario-600"
            />
            <span>Invitado puntual (de otra congregación, para un trabajo concreto)</span>
          </label>
          {form.invitado && (
            <div className="space-y-3 border-l-4 border-primario-200 pl-3 dark:border-primario-800">
              <Campo
                etiqueta="Motivo"
                placeholder="Ej.: instalación eléctrica"
                value={form.invitadoMotivo}
                onChange={(e) => cambiar('invitadoMotivo', e.target.value)}
              />
              <Campo
                etiqueta="Quién lo invitó"
                value={form.invitadoPor}
                onChange={(e) => cambiar('invitadoPor', e.target.value)}
              />
            </div>
          )}

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">Vol. local o A-2</span>
            <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
              {(['Local', 'A-2'] as TipoVoluntario[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={form.tipo === t}
                  onClick={() => cambiar('tipo', t)}
                  className={`py-2.5 font-semibold not-first:border-l not-first:border-slate-300 dark:not-first:border-slate-700 ${
                    form.tipo === t
                      ? 'bg-primario-600 text-white'
                      : 'bg-white text-slate-600 active:bg-slate-100 dark:bg-slate-950 dark:text-slate-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Fecha de nacimiento"
            type="date"
            max={hoyISO()}
            value={form.fechaNacimiento}
            onChange={(e) => cambiar('fechaNacimiento', e.target.value)}
            error={visibles.fechaNacimiento ?? (form.fechaNacimiento > hoyISO() ? 'La fecha no puede ser futura.' : undefined)}
            ayuda={form.fechaNacimiento ? <Edad fechaNacimiento={form.fechaNacimiento} limites={limites} /> : undefined}
          />

          <Campo
            etiqueta="Profesión o habilidad"
            placeholder="Ej.: pintor, electricista, cocina"
            value={form.profesion}
            onChange={(e) => cambiar('profesion', e.target.value)}
          />
        </Tarjeta>

        <Tarjeta titulo="Celulares">
          {form.celulares.map((c, i) => {
            const error = visibles.celular?.[i]
            const varios = form.celulares.length > 1
            return (
              <div key={i}>
                <div className="flex items-center gap-2">
                  <input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="300 123 4567"
                    aria-label={`Celular ${i + 1}`}
                    aria-invalid={!!error}
                    value={c.numero}
                    onChange={(e) => cambiarCelular(i, e.target.value)}
                    onBlur={() => validarCelular(c.numero) && cambiarCelular(i, formatoCelular(c.numero))}
                    className={`${claseInput} flex-1 ${error ? 'border-red-500 dark:border-red-500' : ''}`}
                  />
                  {varios && (
                    <>
                      <button
                        type="button"
                        onClick={() => marcarPrincipal(i)}
                        aria-pressed={c.principal}
                        title="Marcar como principal"
                        className={`shrink-0 rounded-lg px-2.5 py-2.5 text-xs font-semibold ${
                          c.principal
                            ? 'bg-primario-600 text-white'
                            : 'border border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                        }`}
                      >
                        {c.principal ? '★ Principal' : '☆'}
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarCelular(i)}
                        aria-label={`Quitar celular ${i + 1}`}
                        className="shrink-0 rounded-lg p-2.5 text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950"
                      >
                        <IconoBasura className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </div>
                <MensajeError texto={error} />
              </div>
            )
          })}
          {dup.celular.length > 0 && (
            <Aviso>
              {dup.celular
                .map((d) => `El ${formatoCelular(d.numero)} ya es de «${d.voluntario.nombre}».`)
                .join(' ')}
            </Aviso>
          )}
          <button
            type="button"
            onClick={agregarCelular}
            className="flex items-center gap-1.5 text-sm font-semibold text-primario-600 dark:text-primario-300"
          >
            <IconoMasSimbolo className="h-4 w-4" /> Agregar otro celular
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400">+57 · 10 dígitos que empiezan por 3.</p>
        </Tarjeta>

        <Tarjeta titulo="Contacto de emergencia">
          <Campo
            etiqueta="Nombre"
            value={form.emergenciaNombre}
            onChange={(e) => cambiar('emergenciaNombre', e.target.value)}
          />
          <Campo
            etiqueta="Celular"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="300 123 4567"
            value={form.emergenciaCelular}
            onChange={(e) => cambiar('emergenciaCelular', e.target.value)}
            onBlur={() =>
              validarCelular(form.emergenciaCelular) && cambiar('emergenciaCelular', formatoCelular(form.emergenciaCelular))
            }
            error={visibles.emergenciaCelular}
          />
        </Tarjeta>

        <Tarjeta titulo="Días disponibles (cada semana)">
          <SelectorDisponibilidad
            valor={form.disponibilidad}
            onCambiar={(d: Disponibilidad) => cambiar('disponibilidad', d)}
            diasTrabajo={datos.proyecto.diasTrabajo}
          />
        </Tarjeta>

        <Tarjeta titulo="Observaciones">
          <textarea
            aria-label="Observaciones"
            rows={3}
            value={form.observaciones}
            onChange={(e) => cambiar('observaciones', e.target.value)}
            className={claseInput}
          />
        </Tarjeta>

        {intentado && hayErrores(errores) && (
          <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">Revise los campos en rojo.</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => navegar(volver.to)} className={`flex-1 ${claseBotonSecundario}`}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={`flex-1 ${claseBotonPrimario}`}>
            Guardar
          </button>
        </div>
      </form>

      <Dialogo
        abierto={confirmarDup}
        titulo="¿Posible duplicado?"
        onCerrar={() => setConfirmarDup(false)}
        acciones={
          <>
            <button type="button" onClick={() => setConfirmarDup(false)} className={claseBotonSecundario}>
              Revisar
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmarDup(false)
                void grabar()
              }}
              className={claseBotonPrimario}
            >
              Guardar igual
            </button>
          </>
        }
      >
        <ul className="list-disc space-y-1 pl-5">
          {dup.nombre.length > 0 && <li>{textoDupNombre(dup)}</li>}
          {dup.celular.map((d) => (
            <li key={d.numero}>
              El {formatoCelular(d.numero)} ya es de «{d.voluntario.nombre}».
            </li>
          ))}
        </ul>
      </Dialogo>
    </Pagina>
  )
}

function textoDupNombre(dup: DuplicadosVoluntario) {
  return dup.nombre.length === 1
    ? `Ya hay un voluntario llamado «${dup.nombre[0].nombre}».`
    : `Ya hay ${dup.nombre.length} voluntarios con ese nombre.`
}
