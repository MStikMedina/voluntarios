// Tareas o frentes de trabajo (PLAN.md §2.7).
import type { BaseVoluntarios } from '../db/db'
import type { EstadoTarea, Tarea } from '../db/tipos'
import { esFechaISO } from './fechas'
import { normalizar } from './texto'

export type DatosTarea = Omit<Tarea, 'id'>

export interface FormTarea {
  nombre: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
  estado: EstadoTarea
  personasNecesarias: string
  habilidadRequerida: string
}

export type ErroresTarea = Partial<Record<'nombre' | 'fechaFin' | 'personasNecesarias', string>>

export const ESTADOS: { valor: EstadoTarea; texto: string }[] = [
  { valor: 'pendiente', texto: 'Pendiente' },
  { valor: 'en_curso', texto: 'En curso' },
  { valor: 'terminada', texto: 'Terminada' },
]
export const NOMBRE_ESTADO: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_curso: 'En curso',
  terminada: 'Terminada',
}

export function formTareaVacio(): FormTarea {
  return {
    nombre: '', descripcion: '', fechaInicio: '', fechaFin: '', estado: 'pendiente', personasNecesarias: '', habilidadRequerida: '',
  }
}

export function tareaAForm(t: DatosTarea): FormTarea {
  return {
    nombre: t.nombre,
    descripcion: t.descripcion,
    fechaInicio: t.fechaInicio,
    fechaFin: t.fechaFin,
    estado: t.estado,
    personasNecesarias: t.personasNecesarias ? String(t.personasNecesarias) : '',
    habilidadRequerida: t.habilidadRequerida,
  }
}

const limpio = (t: string) => t.replace(/\s+/g, ' ').trim()

export function formATarea(f: FormTarea): DatosTarea {
  const n = parseInt(f.personasNecesarias, 10)
  return {
    nombre: limpio(f.nombre),
    descripcion: f.descripcion.trim(),
    fechaInicio: esFechaISO(f.fechaInicio) ? f.fechaInicio : '',
    fechaFin: esFechaISO(f.fechaFin) ? f.fechaFin : '',
    estado: f.estado,
    personasNecesarias: Number.isFinite(n) && n > 0 ? n : 0,
    habilidadRequerida: limpio(f.habilidadRequerida),
  }
}

export function validarTarea(f: FormTarea): ErroresTarea {
  const e: ErroresTarea = {}
  if (!f.nombre.trim()) e.nombre = 'Escriba el nombre de la tarea.'
  if (f.personasNecesarias.trim() && !/^\d{1,4}$/.test(f.personasNecesarias.trim())) e.personasNecesarias = 'Escriba un número entero.'
  if (f.fechaInicio && f.fechaFin && f.fechaFin < f.fechaInicio) e.fechaFin = 'La fecha de fin no puede ser anterior a la de inicio.'
  return e
}

/** En curso primero, luego pendientes, luego terminadas; dentro, alfabético. */
export function ordenarTareas<T extends Pick<Tarea, 'nombre' | 'estado'>>(lista: T[]): T[] {
  const orden: Record<EstadoTarea, number> = { en_curso: 0, pendiente: 1, terminada: 2 }
  return [...lista].sort(
    (a, b) => orden[a.estado] - orden[b.estado] || normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es'),
  )
}

export async function guardarTarea(db: BaseVoluntarios, datos: DatosTarea, id?: number): Promise<number> {
  if (id === undefined) return db.tareas.add(datos as Tarea)
  await db.tareas.update(id, datos)
  return id
}

/**
 * Borra la tarea. Los voluntarios que la tenían como habitual y la programación quedan sin tarea;
 * en la asistencia se conserva el nombre como texto.
 */
export async function eliminarTarea(db: BaseVoluntarios, id: number): Promise<void> {
  await db.transaction('rw', [db.tareas, db.voluntarios, db.programaciones, db.asistencias, db.dias], async () => {
    const t = await db.tareas.get(id)
    await db.voluntarios.where('tareaHabitualId').equals(id).modify({ tareaHabitualId: null })
    await db.programaciones.where('tareaId').equals(id).modify({ tareaId: null })
    await db.asistencias.where('tareaId').equals(id).modify((a) => {
      a.tareaId = null
      a.tareaTexto = a.tareaTexto || t?.nombre || ''
    })
    await db.dias.toCollection().modify((d) => {
      if (d.cuposTarea && id in d.cuposTarea) delete d.cuposTarea[id]
    })
    await db.tareas.delete(id)
  })
}

// --- Coincidencia de habilidad (profesión del voluntario frente a la habilidad requerida) ---

const VACIAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'o', 'en', 'con', 'para', 'por', 'un', 'una', 'que', 'sin'])

/** Raíz aproximada: pintura → pint, electricidad → electric, albañilería → albanil. */
function raiz(palabra: string): string {
  return palabra.slice(0, Math.max(4, palabra.length - 4))
}

/** ¿La profesión coincide con alguna palabra de la habilidad requerida? */
export function coincideHabilidad(profesion: string | null | undefined, habilidad: string | null | undefined): boolean {
  const palabras = (t: string | null | undefined) =>
    normalizar(t)
      .split(/[^a-z0-9ñ]+/)
      .filter((p) => p.length >= 3 && !VACIAS.has(p))
  const prof = palabras(profesion)
  const hab = palabras(habilidad)
  if (!prof.length || !hab.length) return false
  return hab.some((h) => {
    const r = raiz(h)
    return prof.some((p) => p.startsWith(r) || h.startsWith(raiz(p)))
  })
}
