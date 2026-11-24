import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import Pagina from '../components/Pagina'
import { Campo, Tarjeta, claseInput } from '../components/Campos'
import TelefonoAcciones from '../components/TelefonoAcciones'
import Dialogo, { claseBotonPeligro, claseBotonPrimario, claseBotonSecundario } from '../components/Dialogo'
import {
  CongregacionConVoluntarios, FORM_CONGREGACION_VACIO, congregacionAForm, duplicadosCongregacion,
  eliminarCongregacion, formACongregacion, ordenarCongregaciones, reasignarVoluntarios, validarCongregacion,
  type FormCongregacion,
} from '../lib/congregaciones'
import { formatoCelular, validarCelular } from '../lib/telefono'

const VOLVER = { to: '/mas/congregaciones', texto: 'Congregaciones' }

export default function CongregacionForm() {
  const { id: idTexto } = useParams()
  const nueva = idTexto === 'nueva'
  const id = nueva ? undefined : Number(idTexto)
  const navegar = useNavigate()

  const datos = useLiveQuery(async () => {
    const [todas, actual, voluntarios] = await Promise.all([
      db.congregaciones.toArray(),
      id ? db.congregaciones.get(id) : undefined,
      id ? db.voluntarios.where('congregacionId').equals(id).count() : 0,
    ])
    return { todas, actual: actual ?? null, voluntarios }
  }, [id])

  const [form, setForm] = useState<FormCongregacion | null>(nueva ? { ...FORM_CONGREGACION_VACIO } : null)
  const [intentado, setIntentado] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [dialogo, setDialogo] = useState<'eliminar' | 'reasignar' | null>(null)
  const [destino, setDestino] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)

  if (!nueva && !Number.isInteger(id)) return <Navigate to={VOLVER.to} replace />
  // Carga inicial del formulario al editar (ajuste de estado durante el render).
  if (datos?.actual && !form) setForm(congregacionAForm(datos.actual))

  const titulo = nueva ? 'Nueva congregación' : 'Editar congregación'
  if (!datos || !form) {
    if (datos && !nueva && !datos.actual) return <Navigate to={VOLVER.to} replace />
    return (
      <Pagina titulo={titulo} volver={VOLVER}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const errores = validarCongregacion(form)
  const visibles = intentado ? errores : {}
  const guardar = formACongregacion(form)
  const dup = duplicadosCongregacion(guardar, datos.todas, id)
  const otras = ordenarCongregaciones(datos.todas.filter((c) => c.id !== id))

  function cambiar<K extends keyof FormCongregacion>(campo: K, valor: string) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
  }

  const formatearAlSalir = (campo: 'coordinadorCelular' | 'otroContactoCelular') => () => {
    if (validarCelular(form[campo])) cambiar(campo, formatoCelular(form[campo]))
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (Object.keys(errores).length > 0) {
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    setGuardando(true)
    try {
      if (nueva) await db.congregaciones.add(guardar)
      else await db.congregaciones.update(id!, guardar)
      navegar(VOLVER.to)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    try {
      await eliminarCongregacion(db, id!)
      navegar(VOLVER.to, { replace: true })
    } catch (err) {
      setDialogo(null)
      setMensaje(err instanceof CongregacionConVoluntarios ? err.message : 'No se pudo eliminar.')
    }
  }

  async function reasignar() {
    const movidos = await reasignarVoluntarios(db, id!, Number(destino))
    const nombre = otras.find((c) => c.id === Number(destino))?.nombre ?? ''
    setDialogo(null)
    setDestino('')
    setMensaje(`Se pasaron ${movidos} voluntario(s) a ${nombre}. Ya puede eliminar esta congregación.`)
  }

  const telCampo = (campo: 'coordinadorCelular' | 'otroContactoCelular') => (
    <>
      <Campo
        etiqueta="Celular"
        type="tel"
        inputMode="tel"
        autoComplete="off"
        placeholder="300 123 4567"
        value={form[campo]}
        onChange={(e) => cambiar(campo, e.target.value)}
        onBlur={formatearAlSalir(campo)}
        error={visibles[campo]}
        ayuda="+57 · 10 dígitos"
      />
      {validarCelular(form[campo]) && <TelefonoAcciones numero={form[campo]} compacto />}
    </>
  )

  return (
    <Pagina titulo={titulo} volver={VOLVER}>
      <form onSubmit={enviar} noValidate className="pb-4">
        <Tarjeta titulo="Congregación">
          <Campo
            etiqueta="Nombre *"
            value={form.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={visibles.nombre}
            autoFocus={nueva}
          />
          {dup.nombre && <Aviso texto={`Ya existe una congregación llamada «${dup.nombre.nombre}».`} />}
          <Campo
            etiqueta="Número"
            inputMode="numeric"
            value={form.numero}
            onChange={(e) => cambiar('numero', e.target.value)}
            error={visibles.numero}
          />
          {dup.numero && <Aviso texto={`El número ${dup.numero.numero} ya es de «${dup.numero.nombre}».`} />}
        </Tarjeta>

        <Tarjeta titulo="Coordinador del cuerpo de ancianos">
          <Campo
            etiqueta="Nombre"
            value={form.coordinadorNombre}
            onChange={(e) => cambiar('coordinadorNombre', e.target.value)}
          />
          {telCampo('coordinadorCelular')}
        </Tarjeta>

        <Tarjeta titulo="Otro contacto">
          <Campo
            etiqueta="Nombre"
            value={form.otroContactoNombre}
            onChange={(e) => cambiar('otroContactoNombre', e.target.value)}
          />
          {telCampo('otroContactoCelular')}
        </Tarjeta>

        {intentado && Object.keys(errores).length > 0 && (
          <p className="mb-3 text-center text-sm text-red-600 dark:text-red-400">Revise los campos en rojo.</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => navegar(VOLVER.to)} className={`flex-1 ${claseBotonSecundario}`}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={`flex-1 ${claseBotonPrimario}`}>
            Guardar
          </button>
        </div>
      </form>

      {!nueva && (
        <Tarjeta titulo="Eliminar">
          {mensaje && (
            <p role="status" className="rounded-lg bg-primario-50 p-3 text-sm text-primario-800 dark:bg-primario-900/40 dark:text-primario-100">
              {mensaje}
            </p>
          )}
          {datos.voluntarios === 0 ? (
            <button type="button" onClick={() => setDialogo('eliminar')} className={`w-full ${claseBotonPeligro}`}>
              Eliminar congregación
            </button>
          ) : (
            <>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Tiene <b>{datos.voluntarios}</b> voluntario(s). Para eliminarla, primero páselos a otra congregación.
              </p>
              {otras.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Cree otra congregación para poder pasarlos.</p>
              ) : (
                <div className="flex gap-2">
                  <select
                    aria-label="Pasar los voluntarios a"
                    value={destino}
                    onChange={(e) => setDestino(e.target.value)}
                    className={`${claseInput} flex-1`}
                  >
                    <option value="">Pasarlos a…</option>
                    {otras.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!destino}
                    onClick={() => setDialogo('reasignar')}
                    className={claseBotonSecundario}
                  >
                    Pasar
                  </button>
                </div>
              )}
            </>
          )}
        </Tarjeta>
      )}

      <Dialogo
        abierto={dialogo === 'eliminar'}
        titulo="¿Eliminar congregación?"
        onCerrar={() => setDialogo(null)}
        acciones={
          <>
            <button type="button" onClick={() => setDialogo(null)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={eliminar} className={claseBotonPeligro}>
              Eliminar
            </button>
          </>
        }
      >
        Se borrará «{datos.actual?.nombre}» definitivamente.
      </Dialogo>

      <Dialogo
        abierto={dialogo === 'reasignar'}
        titulo="¿Pasar los voluntarios?"
        onCerrar={() => setDialogo(null)}
        acciones={
          <>
            <button type="button" onClick={() => setDialogo(null)} className={claseBotonSecundario}>
              Cancelar
            </button>
            <button type="button" onClick={reasignar} className={claseBotonPrimario}>
              Pasar
            </button>
          </>
        }
      >
        Los {datos.voluntarios} voluntario(s) de «{datos.actual?.nombre}» pasarán a «
        {otras.find((c) => c.id === Number(destino))?.nombre}».
      </Dialogo>
    </Pagina>
  )
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p className="-mt-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      ⚠ {texto} Puede guardar de todos modos.
    </p>
  )
}
