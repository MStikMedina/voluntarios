import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Jornada } from '../db/tipos'
import Pagina from '../components/Pagina'
import { Campo, MensajeError, Tarjeta, claseInput } from '../components/Campos'
import {
  DIAS_CORTOS, FRECUENCIAS_RESPALDO, ORDEN_DIAS, formAProyecto, hayCambios, proyectoAForm,
  validarAjustes, type FormAjustes,
} from '../lib/ajustes'
import { NOMBRES_DIA, formatoHora } from '../lib/fechas'
import { formatoCelular } from '../lib/telefono'
import { horasDeJornada } from '../lib/horas'

const formatoHoras = (h: number) => `${h.toLocaleString('es-CO', { maximumFractionDigits: 2 })} h`

export default function Ajustes() {
  const guardado = useLiveQuery(() => db.obtenerProyecto())
  const [form, setForm] = useState<FormAjustes | null>(null)
  const [intentado, setIntentado] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  // Carga inicial del formulario con lo guardado (ajuste de estado durante el render).
  if (guardado && !form) setForm(proyectoAForm(guardado))

  // El aviso "Guardado" se quita solo.
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 2500)
    return () => clearTimeout(t)
  }, [aviso])

  if (!guardado || !form) {
    return (
      <Pagina titulo="Ajustes" volver={{ to: '/mas', texto: 'Más' }}>
        <p className="text-slate-500">Cargando…</p>
      </Pagina>
    )
  }

  const errores = validarAjustes(form)
  const visibles = intentado ? errores : {}
  const cambios = hayCambios(form, guardado)
  const datos = formAProyecto(form)

  function cambiar<K extends keyof FormAjustes>(campo: K, valor: FormAjustes[K]) {
    setForm((f) => (f ? { ...f, [campo]: valor } : f))
  }

  function alternarDia(d: number) {
    const dias = form!.diasTrabajo
    cambiar('diasTrabajo', dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d])
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setIntentado(true)
    if (Object.keys(errores).length > 0) {
      setAviso(null)
      // Llevar al primer campo con error.
      setTimeout(() => document.querySelector('[aria-invalid="true"], [data-error]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0)
      return
    }
    setGuardando(true)
    try {
      await db.guardarProyecto(datos)
      setForm(proyectoAForm({ ...guardado!, ...datos }))
      setAviso('Ajustes guardados')
    } finally {
      setGuardando(false)
    }
  }

  function descartar() {
    setForm(proyectoAForm(guardado!))
    setIntentado(false)
  }

  const filaJornada = (j: Jornada, titulo: string) => {
    const ini = j === 'M' ? 'mInicio' : 'tInicio'
    const fin = j === 'M' ? 'mFin' : 'tFin'
    const error = visibles[j === 'M' ? 'jornadaM' : 'jornadaT']
    const horas = errores[j === 'M' ? 'jornadaM' : 'jornadaT'] ? null : horasDeJornada(j, datos.jornadas)
    return (
      <div data-error={error ? '' : undefined}>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{titulo}</span>
          {horas !== null && (
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatoHora(form[ini])} a {formatoHora(form[fin])} · {formatoHoras(horas)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="time"
            aria-label={`${titulo}: inicio`}
            aria-invalid={!!error}
            value={form[ini]}
            onChange={(e) => cambiar(ini, e.target.value)}
            className={`${claseInput} ${error ? 'border-red-500 dark:border-red-500' : ''}`}
          />
          <input
            type="time"
            aria-label={`${titulo}: fin`}
            aria-invalid={!!error}
            value={form[fin]}
            onChange={(e) => cambiar(fin, e.target.value)}
            className={`${claseInput} ${error ? 'border-red-500 dark:border-red-500' : ''}`}
          />
        </div>
        <MensajeError texto={error} />
      </div>
    )
  }

  const horasDia = errores.jornadaM || errores.jornadaT ? null : horasDeJornada('D', datos.jornadas)

  return (
    <Pagina titulo="Ajustes" volver={{ to: '/mas', texto: 'Más' }}>
      <form onSubmit={guardar} noValidate className="pb-20">
        <Tarjeta titulo="Proyecto">
          <Campo
            etiqueta="Nombre del proyecto *"
            value={form.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            error={visibles.nombre}
            placeholder="Remodelación Salón del Reino"
          />
          <Campo etiqueta="Ciudad" value={form.ciudad} onChange={(e) => cambiar('ciudad', e.target.value)} />
          <Campo
            etiqueta="Dirección del Salón"
            value={form.direccion}
            onChange={(e) => cambiar('direccion', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Campo
              etiqueta="Fecha de inicio"
              type="date"
              value={form.fechaInicio}
              onChange={(e) => cambiar('fechaInicio', e.target.value)}
              error={visibles.fechaInicio}
            />
            <Campo
              etiqueta="Fecha de fin"
              type="date"
              value={form.fechaFin}
              min={form.fechaInicio || undefined}
              onChange={(e) => cambiar('fechaFin', e.target.value)}
              error={visibles.fechaFin ?? (errores.fechaFin && form.fechaFin ? errores.fechaFin : undefined)}
            />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Superintendente o encargado">
          <Campo
            etiqueta="Nombre"
            value={form.superintendenteNombre}
            onChange={(e) => cambiar('superintendenteNombre', e.target.value)}
          />
          <Campo
            etiqueta="Celular"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="300 123 4567"
            value={form.superintendenteCelular}
            onChange={(e) => cambiar('superintendenteCelular', e.target.value)}
            onBlur={() => {
              if (!errores.superintendenteCelular) cambiar('superintendenteCelular', formatoCelular(form.superintendenteCelular))
            }}
            error={visibles.superintendenteCelular}
            ayuda="+57 · 10 dígitos"
          />
        </Tarjeta>

        <Tarjeta titulo="Días de trabajo">
          <div data-error={visibles.diasTrabajo ? '' : undefined}>
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
              Son los días sugeridos para programar. Se puede programar cualquier fecha.
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {ORDEN_DIAS.map((d) => {
                const activo = form.diasTrabajo.includes(d)
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={activo}
                    aria-label={NOMBRES_DIA[d]}
                    onClick={() => alternarDia(d)}
                    className={`h-11 rounded-lg text-sm font-semibold transition-colors ${
                      activo
                        ? 'bg-primario-600 text-white active:bg-primario-700'
                        : 'border border-slate-300 text-slate-600 active:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:active:bg-slate-800'
                    }`}
                  >
                    {DIAS_CORTOS[d]}
                  </button>
                )
              })}
            </div>
            <MensajeError texto={visibles.diasTrabajo} />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Horario de las jornadas">
          {filaJornada('M', 'Mañana')}
          {filaJornada('T', 'Tarde')}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Las horas trabajadas se calculan con este horario
            {horasDia !== null && <> (día completo = {formatoHoras(horasDia)})</>}.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Alertas de edad">
          <div className="grid grid-cols-2 gap-2">
            <Campo
              etiqueta="Menor de (años)"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.edadMenor}
              onChange={(e) => cambiar('edadMenor', e.target.value)}
              error={visibles.edadMenor}
            />
            <Campo
              etiqueta="Mayor de (años)"
              type="number"
              inputMode="numeric"
              min={1}
              max={120}
              value={form.edadMayor}
              onChange={(e) => cambiar('edadMayor', e.target.value)}
              error={visibles.edadMayor}
            />
          </div>
        </Tarjeta>

        <Tarjeta titulo="Respaldo">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              Recordatorio de respaldo
            </span>
            <select
              value={form.frecuenciaRespaldo}
              onChange={(e) => cambiar('frecuenciaRespaldo', e.target.value as FormAjustes['frecuenciaRespaldo'])}
              className={claseInput}
            >
              {FRECUENCIAS_RESPALDO.map((f) => (
                <option key={f.valor} value={f.valor}>
                  {f.texto}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
              Se avisa en Inicio si hubo cambios después del último respaldo.
            </span>
          </label>
        </Tarjeta>

        {/* Barra de guardar, fija sobre la barra inferior. */}
        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2">
            <span className="flex-1 text-sm text-slate-500 dark:text-slate-400" role="status">
              {aviso ? (
                <span className="font-medium text-green-700 dark:text-green-400">✓ {aviso}</span>
              ) : intentado && Object.keys(errores).length > 0 ? (
                <span className="text-red-600 dark:text-red-400">Revise los campos en rojo</span>
              ) : cambios ? (
                'Cambios sin guardar'
              ) : (
                'Sin cambios'
              )}
            </span>
            {cambios && (
              <button
                type="button"
                onClick={descartar}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium active:bg-slate-100 dark:border-slate-700 dark:active:bg-slate-800"
              >
                Descartar
              </button>
            )}
            <button
              type="submit"
              disabled={!cambios || guardando}
              className="rounded-lg bg-primario-600 px-5 py-2 text-sm font-semibold text-white active:bg-primario-700 disabled:opacity-40"
            >
              Guardar
            </button>
          </div>
        </div>
      </form>
    </Pagina>
  )
}
