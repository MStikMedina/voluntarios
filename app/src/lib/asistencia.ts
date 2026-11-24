// Asistencia (PLAN.md §2.9): lista con toque, llegada/salida, salida general y no programados.
import type { BaseVoluntarios } from '../db/db'
import type { Asistencia, Jornada, Programacion, Proyecto, Voluntario } from '../db/tipos'
import { aMinutos, hoyISO, horaActual } from './fechas'
import { ocupaCupo } from './programacion'
import { normalizar } from './texto'

/** Jornada que se muestra al abrir: la tarde desde que empieza (o desde que termina la mañana). */
export function jornadaActual(p: Pick<Proyecto, 'jornadas'>, ahora: Date = new Date()): Jornada {
  const min = ahora.getHours() * 60 + ahora.getMinutes()
  const finM = aMinutos(p.jornadas.M.fin) ?? 12 * 60
  const iniT = aMinutos(p.jornadas.T.inicio) ?? 13 * 60
  return min >= Math.min(finM, iniT) ? 'T' : 'M'
}

/** Hora que se propone: la actual si es hoy; si es otro día, el inicio (llegada) o fin (salida) de la jornada. */
export function horaPropuesta(
  fecha: string,
  jornada: Jornada,
  p: Pick<Proyecto, 'jornadas'>,
  tipo: 'llegada' | 'salida',
  hoy: string = hoyISO(),
  ahora: Date = new Date(),
): string {
  if (fecha === hoy) return horaActual(ahora)
  return tipo === 'llegada' ? p.jornadas[jornada].inicio : p.jornadas[jornada].fin
}

export interface FilaAsistencia {
  voluntarioId: number
  nombre: string
  voluntario?: Voluntario
  programacion?: Programacion
  asistencia?: Asistencia
  presente: boolean
  noProgramado: boolean
}

/**
 * Une programados (sin los que «no pueden») y registros de asistencia de una fecha y jornada.
 * Orden alfabético. Quien tiene asistencia pero no estaba programado queda marcado.
 */
export function filasAsistencia(
  progs: Programacion[],
  asistencias: Asistencia[],
  voluntarios: Map<number, Voluntario>,
): FilaAsistencia[] {
  const porVol = new Map<number, FilaAsistencia>()
  for (const p of progs) {
    if (!ocupaCupo(p)) continue
    const v = voluntarios.get(p.voluntarioId)
    porVol.set(p.voluntarioId, {
      voluntarioId: p.voluntarioId,
      nombre: v?.nombre ?? '(borrado)',
      voluntario: v,
      programacion: p,
      presente: false,
      noProgramado: false,
    })
  }
  for (const a of asistencias) {
    const fila = porVol.get(a.voluntarioId)
    if (fila) {
      fila.asistencia = a
      fila.presente = a.asistio
    } else {
      const v = voluntarios.get(a.voluntarioId)
      const prog = progs.find((p) => p.voluntarioId === a.voluntarioId) // p. ej. dijo «no puede» y sí vino
      porVol.set(a.voluntarioId, {
        voluntarioId: a.voluntarioId,
        nombre: v?.nombre ?? '(borrado)',
        voluntario: v,
        programacion: prog,
        asistencia: a,
        presente: a.asistio,
        noProgramado: !prog,
      })
    }
  }
  return [...porVol.values()].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es'))
}

export interface ResumenAsistencia {
  programados: number
  presentes: number
  faltan: number // programados que aún no llegan
  noProgramados: number // presentes sin estar programados
  sinSalida: number // presentes sin hora de salida
}

export function resumenAsistencia(filas: FilaAsistencia[]): ResumenAsistencia {
  const programados = filas.filter((f) => f.programacion && ocupaCupo(f.programacion))
  return {
    programados: programados.length,
    presentes: filas.filter((f) => f.presente).length,
    faltan: programados.filter((f) => !f.presente).length,
    noProgramados: filas.filter((f) => f.presente && f.noProgramado).length,
    sinSalida: filas.filter((f) => f.presente && !f.asistencia?.horaSalida).length,
  }
}

async function buscar(db: BaseVoluntarios, fecha: string, jornada: Jornada, voluntarioId: number) {
  return db.asistencias
    .where('[fecha+jornada]')
    .equals([fecha, jornada])
    .filter((a) => a.voluntarioId === voluntarioId)
    .first()
}

/** Marca la llegada (crea el registro o lo actualiza). No cambia la hora si ya tenía una. */
export async function marcarLlegada(
  db: BaseVoluntarios,
  d: { fecha: string; jornada: Jornada; voluntarioId: number; tareaId: number | null },
  hora: string,
): Promise<number> {
  return db.transaction('rw', db.asistencias, async () => {
    const a = await buscar(db, d.fecha, d.jornada, d.voluntarioId)
    if (a) {
      await db.asistencias.update(a.id, { asistio: true, horaLlegada: a.horaLlegada || hora })
      return a.id
    }
    return db.asistencias.add({ ...d, asistio: true, horaLlegada: hora, observacion: '' } as Asistencia)
  })
}

/** Desmarca la llegada (queda como no asistió, sin horas). */
export async function desmarcarLlegada(db: BaseVoluntarios, id: number) {
  await db.asistencias.update(id, { asistio: false, horaLlegada: undefined, horaSalida: undefined })
}

/** Salida general: pone la hora de salida a todos los presentes que aún no la tienen. Devuelve cuántos. */
export async function salidaGeneral(db: BaseVoluntarios, fecha: string, jornada: Jornada, hora: string): Promise<number> {
  return db.asistencias
    .where('[fecha+jornada]')
    .equals([fecha, jornada])
    .filter((a) => a.asistio && !a.horaSalida)
    .modify({ horaSalida: hora })
}

/** Tarea que se propone al marcar: la de su programación, o su tarea habitual. */
export function tareaPropuesta(f: Pick<FilaAsistencia, 'programacion' | 'voluntario'>): number | null {
  return f.programacion?.tareaId ?? f.voluntario?.tareaHabitualId ?? null
}

/** Valida que la salida no sea antes que la llegada. */
export function errorHoras(llegada?: string, salida?: string): string | null {
  const a = aMinutos(llegada)
  const b = aMinutos(salida)
  if (a !== null && b !== null && b < a) return 'La salida no puede ser antes que la llegada.'
  return null
}
