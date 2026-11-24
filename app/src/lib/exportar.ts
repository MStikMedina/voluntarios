// Exportaciones a Excel (PLAN.md §2.11). Funciones puras que arman las filas de cada hoja.
import type { Asistencia, Congregacion, Dia, Jornada, Programacion, Proyecto, Tarea, Voluntario } from '../db/tipos'
import type { Celda } from './excel'
import { codigosDisponibilidad } from './disponibilidad'
import { edad, formatoFecha, formatoHora, hoyISO, NOMBRES_DIA, diaSemana } from './fechas'
import { horasDeJornada } from './horas'
import { cupoGeneral, NOMBRE_CONFIRMACION, NOMBRE_JORNADA, ocupaCupo } from './programacion'
import { NOMBRE_ESTADO } from './tareas'
import { formatoCelular } from './telefono'
import { normalizar } from './texto'
import { celularPrincipal, ordenarVoluntarios } from './voluntarios'

export interface Rango {
  desde: string // 'YYYY-MM-DD' o '' (sin límite)
  hasta: string
}

export const enRango = (fecha: string, r: Rango) => (!r.desde || fecha >= r.desde) && (!r.hasta || fecha <= r.hasta)

const redondear = (n: number) => Math.round(n * 100) / 100

// --- 1. Listado de voluntarios ---

export const COLUMNAS_LISTADO = [
  'Nombre', 'Congregación', 'Local/A-2', 'Fecha nac.', 'Edad', 'Profesión', 'Celular principal', 'Otros celulares',
  'Contacto emergencia', 'Cel. emergencia', 'Disponibilidad', 'Tarea habitual', 'Invitado', 'Motivo', 'Invitado por',
  'Observaciones',
]

export function filasListado(
  voluntarios: Voluntario[],
  congregaciones: Pick<Congregacion, 'id' | 'nombre'>[],
  tareas: Pick<Tarea, 'id' | 'nombre'>[],
  hoy: string = hoyISO(),
): Celda[][] {
  const cong = new Map(congregaciones.map((c) => [c.id, c.nombre]))
  const tar = new Map(tareas.map((t) => [t.id, t.nombre]))
  return [
    COLUMNAS_LISTADO,
    ...ordenarVoluntarios(voluntarios).map((v) => {
      const principal = celularPrincipal(v)
      return [
        v.nombre,
        v.congregacionId != null ? (cong.get(v.congregacionId) ?? '') : '',
        v.tipo,
        formatoFecha(v.fechaNacimiento),
        edad(v.fechaNacimiento, hoy) ?? '',
        v.profesion,
        formatoCelular(principal),
        v.celulares.filter((c) => c.numero !== principal).map((c) => formatoCelular(c.numero)).join(' / '),
        v.emergenciaNombre,
        formatoCelular(v.emergenciaCelular),
        codigosDisponibilidad(v.disponibilidad),
        v.tareaHabitualId != null ? (tar.get(v.tareaHabitualId) ?? '') : '',
        v.invitado ? 'Sí' : '',
        v.invitadoMotivo,
        v.invitadoPor,
        v.observaciones,
      ]
    }),
  ]
}

// --- 2. Horas y jornadas por voluntario ---

export function filasHoras(
  asistencias: Asistencia[],
  voluntarios: Voluntario[],
  congregaciones: Pick<Congregacion, 'id' | 'nombre'>[],
  proyecto: Pick<Proyecto, 'jornadas'>,
  rango: Rango,
): Celda[][] {
  const cong = new Map(congregaciones.map((c) => [c.id, c.nombre]))
  const acum = new Map<number, { M: number; T: number; horas: number; dias: Set<string> }>()
  for (const a of asistencias) {
    if (!a.asistio || !enRango(a.fecha, rango)) continue
    const x = acum.get(a.voluntarioId) ?? { M: 0, T: 0, horas: 0, dias: new Set<string>() }
    x[a.jornada]++
    x.horas += horasDeJornada(a.jornada, proyecto.jornadas)
    x.dias.add(a.fecha)
    acum.set(a.voluntarioId, x)
  }
  const filas: Celda[][] = [['Nombre', 'Congregación', 'Días', 'Jornadas mañana', 'Jornadas tarde', 'Total jornadas', 'Horas']]
  const tot = { dias: 0, M: 0, T: 0, horas: 0 }
  for (const v of ordenarVoluntarios(voluntarios)) {
    const x = acum.get(v.id)
    if (!x) continue
    filas.push([
      v.nombre,
      v.congregacionId != null ? (cong.get(v.congregacionId) ?? '') : v.invitado ? 'Invitado' : '',
      x.dias.size,
      x.M,
      x.T,
      x.M + x.T,
      redondear(x.horas),
    ])
    tot.dias += x.dias.size
    tot.M += x.M
    tot.T += x.T
    tot.horas += x.horas
  }
  filas.push(['TOTAL', `${filas.length - 1} voluntarios`, tot.dias, tot.M, tot.T, tot.M + tot.T, redondear(tot.horas)])
  return filas
}

// --- 3. Por tarea ---

export function filasPorTarea(
  tareas: Tarea[],
  programaciones: Programacion[],
  asistencias: Asistencia[],
  proyecto: Pick<Proyecto, 'jornadas'>,
  rango: Rango,
): Celda[][] {
  type Acum = { programadas: number; asistidas: number; personas: Set<number>; horas: number }
  const nuevo = (): Acum => ({ programadas: 0, asistidas: 0, personas: new Set(), horas: 0 })
  const acum = new Map<number | null, Acum>()
  const clave = (id: number | null | undefined) => (id != null && tareas.some((t) => t.id === id) ? id : null)
  for (const p of programaciones) {
    if (!ocupaCupo(p) || !enRango(p.fecha, rango)) continue
    const k = clave(p.tareaId)
    const x = acum.get(k) ?? nuevo()
    x.programadas++
    acum.set(k, x)
  }
  for (const a of asistencias) {
    if (!a.asistio || !enRango(a.fecha, rango)) continue
    const k = clave(a.tareaId)
    const x = acum.get(k) ?? nuevo()
    x.asistidas++
    x.personas.add(a.voluntarioId)
    x.horas += horasDeJornada(a.jornada, proyecto.jornadas)
    acum.set(k, x)
  }
  const filas: Celda[][] = [
    ['Tarea', 'Estado', 'Personas necesarias', 'Jornadas programadas', 'Jornadas trabajadas', 'Personas distintas', 'Horas'],
  ]
  const tot = { programadas: 0, asistidas: 0, personas: new Set<number>(), horas: 0 }
  const agregar = (nombre: string, estado: string, necesarias: Celda, x: Acum) => {
    filas.push([nombre, estado, necesarias, x.programadas, x.asistidas, x.personas.size, redondear(x.horas)])
    tot.programadas += x.programadas
    tot.asistidas += x.asistidas
    x.personas.forEach((p) => tot.personas.add(p))
    tot.horas += x.horas
  }
  for (const t of [...tareas].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es'))) {
    agregar(t.nombre, NOMBRE_ESTADO[t.estado], t.personasNecesarias || '', acum.get(t.id) ?? nuevo())
  }
  const sin = acum.get(null)
  if (sin) agregar('Sin tarea', '', '', sin)
  filas.push(['TOTAL', '', '', tot.programadas, tot.asistidas, tot.personas.size, redondear(tot.horas)])
  return filas
}

// --- 4. Por fecha ---

export function filasPorFecha(
  dias: Dia[],
  programaciones: Programacion[],
  asistencias: Asistencia[],
  rango: Rango,
): Celda[][] {
  const fechas = new Set<string>()
  for (const d of dias) if (d.cupoM != null || d.cupoT != null) fechas.add(d.fecha)
  for (const p of programaciones) fechas.add(p.fecha)
  for (const a of asistencias) fechas.add(a.fecha)
  const filas: Celda[][] = [
    ['Fecha', 'Día', 'Jornada', 'Cupo', 'Programados', 'Confirmados', 'Pendientes', 'No pueden', 'Asistentes', 'Faltaron (programados)', 'No programados'],
  ]
  const tot = [0, 0, 0, 0, 0, 0, 0, 0]
  for (const f of [...fechas].filter((x) => enRango(x, rango)).sort()) {
    const dia = dias.find((d) => d.fecha === f)
    for (const j of ['M', 'T'] as Jornada[]) {
      const progs = programaciones.filter((p) => p.fecha === f && p.jornada === j)
      const asis = asistencias.filter((a) => a.fecha === f && a.jornada === j && a.asistio)
      const cupo = cupoGeneral(dia, j)
      if (!progs.length && !asis.length && cupo === null) continue
      const activos = progs.filter(ocupaCupo)
      const idsAsis = new Set(asis.map((a) => a.voluntarioId))
      const idsProg = new Set(activos.map((p) => p.voluntarioId))
      const fila = [
        cupo ?? 0,
        activos.length,
        progs.filter((p) => p.confirmacion === 'confirmado').length,
        progs.filter((p) => p.confirmacion === 'pendiente').length,
        progs.filter((p) => p.confirmacion === 'no_puede').length,
        asis.length,
        activos.filter((p) => !idsAsis.has(p.voluntarioId)).length,
        asis.filter((a) => !idsProg.has(a.voluntarioId)).length,
      ]
      fila.forEach((n, i) => (tot[i] += n))
      filas.push([formatoFecha(f), NOMBRES_DIA[diaSemana(f)], NOMBRE_JORNADA[j], cupo ?? 'sin cupo', ...fila.slice(1)])
    }
  }
  filas.push(['TOTAL', '', '', tot[0], ...tot.slice(1)])
  return filas
}

// --- Detalle de asistencia (hoja extra para revisar) ---

export function filasDetalleAsistencia(
  asistencias: Asistencia[],
  programaciones: Programacion[],
  voluntarios: Voluntario[],
  tareas: Pick<Tarea, 'id' | 'nombre'>[],
  rango: Rango,
): Celda[][] {
  const vol = new Map(voluntarios.map((v) => [v.id, v.nombre]))
  const tar = new Map(tareas.map((t) => [t.id, t.nombre]))
  const filas: Celda[][] = [['Fecha', 'Jornada', 'Nombre', 'Asistió', 'Llegada', 'Salida', 'Tarea', 'Confirmación', 'Observación']]
  const lista = asistencias
    .filter((a) => enRango(a.fecha, rango))
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.jornada.localeCompare(b.jornada) ||
      normalizar(vol.get(a.voluntarioId) ?? '').localeCompare(normalizar(vol.get(b.voluntarioId) ?? ''), 'es'))
  for (const a of lista) {
    const p = programaciones.find((x) => x.fecha === a.fecha && x.jornada === a.jornada && x.voluntarioId === a.voluntarioId)
    filas.push([
      formatoFecha(a.fecha),
      NOMBRE_JORNADA[a.jornada],
      vol.get(a.voluntarioId) ?? '(borrado)',
      a.asistio ? 'Sí' : 'No',
      formatoHora(a.horaLlegada),
      formatoHora(a.horaSalida),
      [a.tareaId != null ? tar.get(a.tareaId) : '', a.tareaTexto].filter(Boolean).join(' – '),
      p ? NOMBRE_CONFIRMACION[p.confirmacion] : 'No programado',
      a.observacion,
    ])
  }
  return filas
}

export function nombreArchivoExport(tipo: string, fecha: string = hoyISO()): string {
  return `voluntarios-${tipo}-${fecha}.xlsx`
}
