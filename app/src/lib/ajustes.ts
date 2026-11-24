// Formulario de Ajustes del proyecto (PLAN.md §2.2): conversión y validación.
import type { FrecuenciaRespaldo, Proyecto } from '../db/tipos'
import { aMinutos, esFechaISO, formatoHora } from './fechas'
import { formatoCelular, limpiarCelular, validarCelular } from './telefono'

/** Valores del formulario (las edades como texto, tal como se escriben). */
export interface FormAjustes {
  nombre: string
  ciudad: string
  direccion: string
  fechaInicio: string
  fechaFin: string
  superintendenteNombre: string
  superintendenteCelular: string
  diasTrabajo: number[]
  mInicio: string
  mFin: string
  tInicio: string
  tFin: string
  edadMenor: string
  edadMayor: string
  frecuenciaRespaldo: FrecuenciaRespaldo
}

export type CampoAjustes =
  | 'nombre' | 'fechaInicio' | 'fechaFin' | 'superintendenteCelular' | 'diasTrabajo'
  | 'jornadaM' | 'jornadaT' | 'edadMenor' | 'edadMayor'

export type ErroresAjustes = Partial<Record<CampoAjustes, string>>

export const FRECUENCIAS_RESPALDO: { valor: FrecuenciaRespaldo; texto: string }[] = [
  { valor: 'diario', texto: 'Diario' },
  { valor: 'semanal', texto: 'Semanal' },
]

/** Orden de los días en pantalla: lunes primero (0 = domingo … 6 = sábado). */
export const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0]
export const DIAS_CORTOS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá']

export function proyectoAForm(p: Proyecto): FormAjustes {
  return {
    nombre: p.nombre,
    ciudad: p.ciudad,
    direccion: p.direccion,
    fechaInicio: p.fechaInicio,
    fechaFin: p.fechaFin,
    superintendenteNombre: p.superintendenteNombre,
    superintendenteCelular: formatoCelular(p.superintendenteCelular),
    diasTrabajo: [...p.diasTrabajo],
    mInicio: p.jornadas.M.inicio,
    mFin: p.jornadas.M.fin,
    tInicio: p.jornadas.T.inicio,
    tFin: p.jornadas.T.fin,
    edadMenor: String(p.edadMenor),
    edadMayor: String(p.edadMayor),
    frecuenciaRespaldo: p.frecuenciaRespaldo,
  }
}

/** Lo que se guarda (textos sin espacios sobrantes, celular solo con dígitos, días ordenados). */
export function formAProyecto(f: FormAjustes): Omit<Proyecto, 'id' | 'ultimoRespaldo' | 'ultimoCambio'> {
  return {
    nombre: f.nombre.trim(),
    ciudad: f.ciudad.trim(),
    direccion: f.direccion.trim(),
    fechaInicio: f.fechaInicio,
    fechaFin: f.fechaFin,
    superintendenteNombre: f.superintendenteNombre.trim(),
    superintendenteCelular: limpiarCelular(f.superintendenteCelular),
    diasTrabajo: [...new Set(f.diasTrabajo)].sort((a, b) => a - b),
    jornadas: {
      M: { inicio: f.mInicio, fin: f.mFin },
      T: { inicio: f.tInicio, fin: f.tFin },
    },
    edadMenor: Number(f.edadMenor),
    edadMayor: Number(f.edadMayor),
    frecuenciaRespaldo: f.frecuenciaRespaldo,
  }
}

function edadValida(texto: string): number | null {
  const t = texto.trim()
  if (!/^\d{1,3}$/.test(t)) return null
  const n = Number(t)
  return n >= 1 && n <= 120 ? n : null
}

function errorHorario(inicio: string, fin: string): string | undefined {
  const a = aMinutos(inicio)
  const b = aMinutos(fin)
  if (a === null || b === null) return 'Escriba la hora de inicio y la de fin.'
  if (b <= a) return 'La hora de fin debe ser después de la de inicio.'
  return undefined
}

/** Errores por campo. Objeto vacío = se puede guardar. */
export function validarAjustes(f: FormAjustes): ErroresAjustes {
  const e: ErroresAjustes = {}

  if (!f.nombre.trim()) e.nombre = 'Escriba el nombre del proyecto.'

  if (f.fechaInicio && !esFechaISO(f.fechaInicio)) e.fechaInicio = 'Fecha no válida.'
  if (f.fechaFin && !esFechaISO(f.fechaFin)) e.fechaFin = 'Fecha no válida.'
  if (!e.fechaInicio && !e.fechaFin && f.fechaInicio && f.fechaFin && f.fechaFin < f.fechaInicio) {
    e.fechaFin = 'La fecha de fin no puede quedar antes de la de inicio.'
  }

  if (f.superintendenteCelular.trim() && !validarCelular(f.superintendenteCelular)) {
    e.superintendenteCelular = 'Debe tener 10 dígitos y empezar por 3 (3xx xxx xxxx).'
  }

  if (f.diasTrabajo.length === 0) e.diasTrabajo = 'Elija al menos un día de trabajo.'

  const errM = errorHorario(f.mInicio, f.mFin)
  const errT = errorHorario(f.tInicio, f.tFin)
  if (errM) e.jornadaM = errM
  if (errT) e.jornadaT = errT
  if (!errM && !errT && (aMinutos(f.tInicio) as number) < (aMinutos(f.mFin) as number)) {
    e.jornadaT = `La tarde no puede empezar antes de que termine la mañana (${formatoHora(f.mFin)}).`
  }

  const menor = edadValida(f.edadMenor)
  const mayor = edadValida(f.edadMayor)
  if (menor === null) e.edadMenor = 'Escriba una edad entre 1 y 120.'
  if (mayor === null) e.edadMayor = 'Escriba una edad entre 1 y 120.'
  if (menor !== null && mayor !== null && menor >= mayor) {
    e.edadMayor = 'Debe ser mayor que la edad de la alerta de menor.'
  }

  return e
}

/** ¿El formulario tiene cambios frente a lo guardado? */
export function hayCambios(f: FormAjustes, guardado: Proyecto): boolean {
  return JSON.stringify(formAProyecto(f)) !== JSON.stringify(formAProyecto(proyectoAForm(guardado)))
}
