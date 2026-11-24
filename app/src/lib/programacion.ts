// Programación por día (PLAN.md §2.8): cupos, sugeridos, avisos y guardado.
import type { BaseVoluntarios } from '../db/db'
import type { Confirmacion, Dia, Jornada, Programacion, Tarea, Voluntario } from '../db/tipos'
import { disponibleEn } from './disponibilidad'
import { diaSemana, esFechaISO, hoyISO, sumarDias } from './fechas'
import { normalizar } from './texto'
import { coincideHabilidad } from './tareas'

export const NOMBRE_JORNADA: Record<Jornada, string> = { M: 'Mañana', T: 'Tarde' }
export const NOMBRE_CONFIRMACION: Record<Confirmacion, string> = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  no_puede: 'No puede',
}

export function diaVacio(fecha: string): Dia {
  return { fecha, cupoM: null, cupoT: null, cuposTarea: {}, notas: '' }
}

export function cupoGeneral(dia: Dia | undefined | null, jornada: Jornada): number | null {
  const c = jornada === 'M' ? dia?.cupoM : dia?.cupoT
  return typeof c === 'number' && c >= 0 ? c : null
}

/** Cupo de la tarea en esa fecha: el ajustado del día o, si no hay, las personas necesarias (null = sin cupo). */
export function cupoTarea(tarea: Pick<Tarea, 'id' | 'personasNecesarias'>, dia: Dia | undefined | null): number | null {
  const ajustado = dia?.cuposTarea?.[tarea.id]
  if (typeof ajustado === 'number') return ajustado
  return tarea.personasNecesarias > 0 ? tarea.personasNecesarias : null
}

/** ¿Cuenta para el cupo? Los que «no pueden» no ocupan cupo. */
export const ocupaCupo = (p: Pick<Programacion, 'confirmacion'>) => p.confirmacion !== 'no_puede'

export interface ResumenTarea {
  tareaId: number | null
  cupo: number | null
  programados: number
}

export interface ResumenJornada {
  cupo: number | null
  programados: number // ocupan cupo (pendiente + confirmado)
  confirmados: number
  pendientes: number
  noPuede: number
  faltan: number | null // cupo - programados (puede ser negativo = excedido)
  porTarea: ResumenTarea[]
}

export function resumenJornada(
  progs: Pick<Programacion, 'jornada' | 'confirmacion' | 'tareaId'>[],
  jornada: Jornada,
  dia: Dia | undefined | null,
  tareas: Pick<Tarea, 'id' | 'personasNecesarias'>[],
): ResumenJornada {
  const deJornada = progs.filter((p) => p.jornada === jornada)
  const activos = deJornada.filter(ocupaCupo)
  const cupo = cupoGeneral(dia, jornada)
  const porTareaMapa = new Map<number | null, number>()
  for (const p of activos) porTareaMapa.set(p.tareaId ?? null, (porTareaMapa.get(p.tareaId ?? null) ?? 0) + 1)
  const porTarea: ResumenTarea[] = tareas.map((t) => ({ tareaId: t.id, cupo: cupoTarea(t, dia), programados: porTareaMapa.get(t.id) ?? 0 }))
  const sinTarea = porTareaMapa.get(null) ?? 0
  if (sinTarea) porTarea.push({ tareaId: null, cupo: null, programados: sinTarea })
  return {
    cupo,
    programados: activos.length,
    confirmados: deJornada.filter((p) => p.confirmacion === 'confirmado').length,
    pendientes: deJornada.filter((p) => p.confirmacion === 'pendiente').length,
    noPuede: deJornada.filter((p) => p.confirmacion === 'no_puede').length,
    faltan: cupo === null ? null : cupo - activos.length,
    porTarea,
  }
}

/** Tareas que se ofrecen para una fecha: no terminadas y dentro de sus fechas (si las tienen). */
export function tareasDeFecha<T extends Pick<Tarea, 'estado' | 'fechaInicio' | 'fechaFin'>>(tareas: T[], fecha: string): T[] {
  return tareas.filter(
    (t) => t.estado !== 'terminada' && (!t.fechaInicio || fecha >= t.fechaInicio) && (!t.fechaFin || fecha <= t.fechaFin),
  )
}

export interface Sugerido<V> {
  voluntario: V
  disponible: boolean
  coincide: boolean // profesión coincide con la habilidad de la tarea elegida
  habitual: boolean // la tarea elegida es su tarea habitual
}

/**
 * Voluntarios para agregar a una fecha y jornada: excluye a los ya programados en esa jornada.
 * Orden: disponibles primero; dentro, los de la tarea habitual elegida, luego los que coinciden
 * con la habilidad requerida, y luego alfabético.
 */
export function sugeridos<V extends Pick<Voluntario, 'id' | 'nombre' | 'profesion' | 'disponibilidad' | 'tareaHabitualId'>>(
  voluntarios: V[],
  fecha: string,
  jornada: Jornada,
  yaProgramados: Set<number>,
  tarea?: Pick<Tarea, 'id' | 'habilidadRequerida'> | null,
  incluirNoDisponibles = false,
): Sugerido<V>[] {
  return voluntarios
    .filter((v) => !yaProgramados.has(v.id))
    .map((v) => ({
      voluntario: v,
      disponible: disponibleEn(v, fecha, jornada),
      coincide: !!tarea && coincideHabilidad(v.profesion, tarea.habilidadRequerida),
      habitual: !!tarea && v.tareaHabitualId === tarea.id,
    }))
    .filter((s) => incluirNoDisponibles || s.disponible)
    .sort(
      (a, b) =>
        Number(b.disponible) - Number(a.disponible) ||
        Number(b.habitual) - Number(a.habitual) ||
        Number(b.coincide) - Number(a.coincide) ||
        normalizar(a.voluntario.nombre).localeCompare(normalizar(b.voluntario.nombre), 'es'),
    )
}

export type AvisoProgramar = 'fuera_disponibilidad' | 'sin_cupo' | 'cupo_superado' | 'cupo_tarea_superado'

/** Avisos (no bloquean) al agregar a alguien a una jornada. */
export function avisosAlProgramar(
  v: Pick<Voluntario, 'disponibilidad'>,
  fecha: string,
  jornada: Jornada,
  resumen: ResumenJornada,
  tareaId: number | null,
): AvisoProgramar[] {
  const a: AvisoProgramar[] = []
  if (!disponibleEn(v, fecha, jornada)) a.push('fuera_disponibilidad')
  if (resumen.cupo === null) a.push('sin_cupo')
  else if (resumen.programados + 1 > resumen.cupo) a.push('cupo_superado')
  const t = resumen.porTarea.find((x) => x.tareaId === tareaId && tareaId !== null)
  if (t && t.cupo !== null && t.programados + 1 > t.cupo) a.push('cupo_tarea_superado')
  return a
}

export const TEXTO_AVISO: Record<AvisoProgramar, string> = {
  fuera_disponibilidad: 'está fuera de su disponibilidad',
  sin_cupo: 'la jornada no tiene cupo definido',
  cupo_superado: 'se supera el cupo de la jornada',
  cupo_tarea_superado: 'se supera el cupo de la tarea',
}

/** Fecha que se muestra al abrir Programación: hoy si es día de trabajo, si no el siguiente día de trabajo. */
export function fechaInicialProgramacion(diasTrabajo: number[], hoy: string = hoyISO()): string {
  if (!diasTrabajo.length) return hoy
  for (let i = 0; i < 7; i++) {
    const f = sumarDias(hoy, i)
    if (diasTrabajo.includes(diaSemana(f))) return f
  }
  return hoy
}

/** Siguiente (o anterior) día de trabajo; si no hay días de trabajo, el día siguiente. */
export function otroDiaTrabajo(fecha: string, paso: 1 | -1, diasTrabajo: number[]): string {
  for (let i = 1; i <= 7; i++) {
    const f = sumarDias(fecha, i * paso)
    if (!diasTrabajo.length || diasTrabajo.includes(diaSemana(f))) return f
  }
  return sumarDias(fecha, paso)
}

export const fechaValida = (f: string | null): f is string => esFechaISO(f)

// --- Escritura ---

export async function guardarCupo(db: BaseVoluntarios, fecha: string, jornada: Jornada, cupo: number | null) {
  await db.transaction('rw', db.dias, async () => {
    const d = (await db.dias.get(fecha)) ?? diaVacio(fecha)
    await db.dias.put({ ...d, cuposTarea: d.cuposTarea ?? {}, [jornada === 'M' ? 'cupoM' : 'cupoT']: cupo })
  })
}

/** Ajusta el cupo de una tarea en la fecha (null = volver al valor por defecto de la tarea). */
export async function guardarCupoTarea(db: BaseVoluntarios, fecha: string, tareaId: number, cupo: number | null) {
  await db.transaction('rw', db.dias, async () => {
    const d = (await db.dias.get(fecha)) ?? diaVacio(fecha)
    const cuposTarea = { ...(d.cuposTarea ?? {}) }
    if (cupo === null) delete cuposTarea[tareaId]
    else cuposTarea[tareaId] = cupo
    await db.dias.put({ ...d, cuposTarea })
  })
}

/** Programa a un voluntario (si ya está en esa fecha y jornada, no lo repite). Devuelve el id. */
export async function programar(
  db: BaseVoluntarios,
  p: { fecha: string; jornada: Jornada; voluntarioId: number; tareaId: number | null },
): Promise<number> {
  return db.transaction('rw', db.programaciones, async () => {
    const existente = await db.programaciones
      .where('[fecha+jornada]')
      .equals([p.fecha, p.jornada])
      .filter((x) => x.voluntarioId === p.voluntarioId)
      .first()
    if (existente) return existente.id
    return db.programaciones.add({ ...p, confirmacion: 'pendiente', mensajeEnviado: false } as Programacion)
  })
}

export async function quitarProgramacion(db: BaseVoluntarios, id: number) {
  await db.programaciones.delete(id)
}

/**
 * Copia la programación (y los cupos) de una fecha a otra. No repite a quien ya esté.
 * Las confirmaciones vuelven a «pendiente». Devuelve cuántos se copiaron.
 */
export async function copiarProgramacion(db: BaseVoluntarios, desde: string, hacia: string): Promise<number> {
  if (desde === hacia) return 0
  return db.transaction('rw', db.programaciones, db.dias, async () => {
    const origen = await db.programaciones.where('fecha').equals(desde).toArray()
    const destino = await db.programaciones.where('fecha').equals(hacia).toArray()
    const ya = new Set(destino.map((p) => `${p.jornada}-${p.voluntarioId}`))
    const nuevos = origen
      .filter((p) => !ya.has(`${p.jornada}-${p.voluntarioId}`))
      .map(({ jornada, voluntarioId, tareaId }) => ({
        fecha: hacia, jornada, voluntarioId, tareaId: tareaId ?? null, confirmacion: 'pendiente', mensajeEnviado: false,
      }) as Programacion)
    if (nuevos.length) await db.programaciones.bulkAdd(nuevos)
    const dOrigen = await db.dias.get(desde)
    const dDestino = (await db.dias.get(hacia)) ?? diaVacio(hacia)
    if (dOrigen) {
      await db.dias.put({
        ...dDestino,
        cupoM: dDestino.cupoM ?? dOrigen.cupoM ?? null,
        cupoT: dDestino.cupoT ?? dOrigen.cupoT ?? null,
        cuposTarea: { ...(dOrigen.cuposTarea ?? {}), ...(dDestino.cuposTarea ?? {}) },
      })
    }
    return nuevos.length
  })
}

/** Ordena programados por tarea (según el orden de `tareas`) y luego por nombre. */
export function agruparPorTarea<P extends { tareaId?: number | null; nombre: string }>(
  lista: P[],
  tareas: Pick<Tarea, 'id' | 'nombre'>[],
): { tarea: Pick<Tarea, 'id' | 'nombre'> | null; items: P[] }[] {
  const grupos: { tarea: Pick<Tarea, 'id' | 'nombre'> | null; items: P[] }[] = []
  const orden = (a: P, b: P) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es')
  for (const t of tareas) {
    const items = lista.filter((p) => p.tareaId === t.id).sort(orden)
    if (items.length) grupos.push({ tarea: t, items })
  }
  const conocidas = new Set(tareas.map((t) => t.id))
  const resto = lista.filter((p) => p.tareaId == null || !conocidas.has(p.tareaId)).sort(orden)
  if (resto.length) grupos.push({ tarea: null, items: resto })
  return grupos
}
