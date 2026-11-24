// Voluntarios (PLAN.md §2.4): formulario, validación, duplicados, guardado y borrado.
import type { BaseVoluntarios } from '../db/db'
import type { Disponibilidad, NuevoVoluntario, TipoVoluntario, Turno, Voluntario } from '../db/tipos'
import { disponibilidadVacia } from './disponibilidad'
import { edad, esFechaISO, hoyISO } from './fechas'
import { formatoCelular, limpiarCelular, validarCelular } from './telefono'
import { normalizar } from './texto'

export interface FormCelular {
  numero: string
  principal: boolean
}

export interface FormVoluntario {
  nombre: string
  congregacionId: string // '' = sin congregación (solo invitados)
  invitado: boolean
  invitadoMotivo: string
  invitadoPor: string
  tipo: TipoVoluntario
  fechaNacimiento: string // 'YYYY-MM-DD' o ''
  profesion: string
  celulares: FormCelular[]
  emergenciaNombre: string
  emergenciaCelular: string
  disponibilidad: Disponibilidad
  tareaHabitualId: number | null
  observaciones: string
}

export type ErroresVoluntario = Partial<
  Record<'nombre' | 'congregacionId' | 'fechaNacimiento' | 'emergenciaCelular' | 'celulares', string>
> & { celular?: Record<number, string> }

export function formVoluntarioVacio(): FormVoluntario {
  return {
    nombre: '',
    congregacionId: '',
    invitado: false,
    invitadoMotivo: '',
    invitadoPor: '',
    tipo: 'Local',
    fechaNacimiento: '',
    profesion: '',
    celulares: [{ numero: '', principal: true }],
    emergenciaNombre: '',
    emergenciaCelular: '',
    disponibilidad: disponibilidadVacia(),
    tareaHabitualId: null,
    observaciones: '',
  }
}

export function voluntarioAForm(v: NuevoVoluntario): FormVoluntario {
  const celulares = v.celulares.length
    ? v.celulares.map((c) => ({ numero: formatoCelular(c.numero), principal: c.principal }))
    : [{ numero: '', principal: true }]
  return {
    nombre: v.nombre,
    congregacionId: v.congregacionId == null ? '' : String(v.congregacionId),
    invitado: v.invitado,
    invitadoMotivo: v.invitadoMotivo,
    invitadoPor: v.invitadoPor,
    tipo: v.tipo,
    fechaNacimiento: v.fechaNacimiento,
    profesion: v.profesion,
    celulares: asegurarPrincipal(celulares),
    emergenciaNombre: v.emergenciaNombre,
    emergenciaCelular: formatoCelular(v.emergenciaCelular),
    disponibilidad: normalizarDisponibilidad(v.disponibilidad),
    tareaHabitualId: v.tareaHabitualId ?? null,
    observaciones: v.observaciones,
  }
}

const limpio = (t: string) => t.replace(/\s+/g, ' ').trim()

/** Siempre hay exactamente un principal (el primero si no hay ninguno marcado). */
export function asegurarPrincipal<T extends { principal: boolean }>(lista: T[]): T[] {
  const i = lista.findIndex((c) => c.principal)
  const elegido = i < 0 ? 0 : i
  return lista.map((c, j) => ({ ...c, principal: j === elegido }))
}

function normalizarDisponibilidad(d: Disponibilidad | null | undefined): Disponibilidad {
  const r = disponibilidadVacia()
  for (let i = 0; i < 7; i++) {
    const t = d?.[i]
    r[i] = t === 'M' || t === 'T' || t === 'D' ? (t as Turno) : null
  }
  return r
}

/** Lo que se guarda: textos limpios, celulares solo dígitos, sin filas vacías ni repetidas. */
export function formAVoluntario(f: FormVoluntario): NuevoVoluntario {
  const vistos = new Set<string>()
  const celulares = f.celulares
    .map((c) => ({ numero: limpiarCelular(c.numero), principal: c.principal }))
    .filter((c) => {
      if (!c.numero || vistos.has(c.numero)) return false
      vistos.add(c.numero)
      return true
    })
  return {
    nombre: limpio(f.nombre),
    congregacionId: f.congregacionId ? Number(f.congregacionId) : null,
    invitado: f.invitado,
    invitadoMotivo: f.invitado ? limpio(f.invitadoMotivo) : '',
    invitadoPor: f.invitado ? limpio(f.invitadoPor) : '',
    tipo: f.tipo === 'A-2' ? 'A-2' : 'Local',
    fechaNacimiento: esFechaISO(f.fechaNacimiento) ? f.fechaNacimiento : '',
    profesion: limpio(f.profesion),
    celulares: asegurarPrincipal(celulares),
    emergenciaNombre: limpio(f.emergenciaNombre),
    emergenciaCelular: limpiarCelular(f.emergenciaCelular),
    disponibilidad: normalizarDisponibilidad(f.disponibilidad),
    tareaHabitualId: f.tareaHabitualId,
    observaciones: f.observaciones.trim(),
  }
}

export const MSJ_CELULAR = 'Debe tener 10 dígitos y empezar por 3 (300 123 4567).'

export function validarVoluntario(f: FormVoluntario, hoy: string = hoyISO()): ErroresVoluntario {
  const e: ErroresVoluntario = {}
  if (!f.nombre.trim()) e.nombre = 'Escriba el nombre.'
  if (!f.invitado && !f.congregacionId) e.congregacionId = 'Elija la congregación (o marque «Invitado puntual»).'
  if (f.fechaNacimiento) {
    const años = edad(f.fechaNacimiento, hoy)
    if (años === null) e.fechaNacimiento = 'Fecha no válida.'
    else if (f.fechaNacimiento > hoy) e.fechaNacimiento = 'La fecha no puede ser futura.'
    else if (años > 110) e.fechaNacimiento = 'Revise el año de nacimiento.'
  }
  const celular: Record<number, string> = {}
  const vistos = new Map<string, number>()
  f.celulares.forEach((c, i) => {
    if (!c.numero.trim()) return
    if (!validarCelular(c.numero)) celular[i] = MSJ_CELULAR
    else {
      const n = limpiarCelular(c.numero)
      if (vistos.has(n)) celular[i] = 'Este número ya está arriba.'
      else vistos.set(n, i)
    }
  })
  if (Object.keys(celular).length) e.celular = celular
  if (f.emergenciaCelular.trim() && !validarCelular(f.emergenciaCelular)) e.emergenciaCelular = MSJ_CELULAR
  return e
}

export const hayErrores = (e: ErroresVoluntario) => Object.keys(e).length > 0

/** Celular principal (o el primero), o '' si no tiene. */
export function celularPrincipal(v: Pick<Voluntario, 'celulares'>): string {
  return (v.celulares.find((c) => c.principal) ?? v.celulares[0])?.numero ?? ''
}

export interface DuplicadosVoluntario {
  nombre: Voluntario[]
  celular: { numero: string; voluntario: Voluntario }[]
}

/** Otros voluntarios con el mismo nombre (normalizado) o algún celular igual. Solo avisa. */
export function duplicadosVoluntario(
  datos: Pick<NuevoVoluntario, 'nombre' | 'celulares'>,
  todos: Voluntario[],
  idPropio?: number,
): DuplicadosVoluntario {
  const nombre = normalizar(datos.nombre)
  const otros = todos.filter((v) => v.id !== idPropio)
  const celular: DuplicadosVoluntario['celular'] = []
  for (const c of datos.celulares) {
    const n = limpiarCelular(c.numero)
    if (!n) continue
    const otro = otros.find((v) => v.celulares.some((x) => limpiarCelular(x.numero) === n))
    if (otro) celular.push({ numero: n, voluntario: otro })
  }
  return {
    nombre: nombre ? otros.filter((v) => (v.nombreNorm || normalizar(v.nombre)) === nombre) : [],
    celular,
  }
}

export const hayDuplicados = (d: DuplicadosVoluntario) => d.nombre.length > 0 || d.celular.length > 0

/** Crea (sin id) o actualiza un voluntario. Los campos *Norm los pone la base. Devuelve el id. */
export async function guardarVoluntario(db: BaseVoluntarios, datos: NuevoVoluntario, id?: number): Promise<number> {
  const ahora = new Date().toISOString()
  if (id === undefined) {
    return db.voluntarios.add({ ...datos, nombreNorm: '', profesionNorm: '', creado: ahora, actualizado: ahora } as Voluntario)
  }
  const actual = await db.voluntarios.get(id)
  if (!actual) throw new Error('El voluntario ya no existe.')
  await db.voluntarios.put({ ...actual, ...datos, id, actualizado: ahora })
  return id
}

/** Borra definitivamente el voluntario junto con su programación y su asistencia. */
export async function eliminarVoluntario(db: BaseVoluntarios, id: number): Promise<void> {
  await db.transaction('rw', db.voluntarios, db.programaciones, db.asistencias, async () => {
    await db.programaciones.where('voluntarioId').equals(id).delete()
    await db.asistencias.where('voluntarioId').equals(id).delete()
    await db.voluntarios.delete(id)
  })
}

/** Orden alfabético (sin importar tildes ni mayúsculas). */
export function ordenarVoluntarios<T extends Pick<Voluntario, 'nombre'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es'))
}

export const NOMBRES_TURNO: Record<Turno, string> = { M: 'Mañana', T: 'Tarde', D: 'Día completo' }
