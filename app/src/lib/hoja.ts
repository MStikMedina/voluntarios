// Modelo de la hoja imprimible de la programación (PNG / PDF), PLAN.md §2.8.
import type { Dia, Jornada, Programacion, Proyecto, Tarea, Voluntario } from '../db/tipos'
import { fechaLarga } from './fechas'
import { horarioTexto, nombreProyecto } from './mensajes'
import { agruparPorTarea, cupoGeneral, NOMBRE_JORNADA, ocupaCupo } from './programacion'
import { formatoCelular } from './telefono'
import { celularPrincipal } from './voluntarios'

export interface PersonaHoja {
  nombre: string
  celular: string
  confirmado: boolean
}

export interface JornadaHoja {
  jornada: Jornada
  titulo: string // 'Mañana'
  horario: string
  total: number
  cupo: number | null
  grupos: { tarea: string; personas: PersonaHoja[] }[]
}

export interface Hoja {
  proyecto: string
  fecha: string // 'sábado 05/12/2026'
  direccion: string
  encargado: string
  jornadas: JornadaHoja[]
}

export function hojaProgramacion(o: {
  proyecto: Pick<Proyecto, 'nombre' | 'jornadas' | 'direccion' | 'superintendenteNombre' | 'superintendenteCelular'>
  fecha: string
  dia: Dia | null | undefined
  jornadas: Jornada[]
  programaciones: Pick<Programacion, 'jornada' | 'voluntarioId' | 'tareaId' | 'confirmacion'>[]
  voluntarios: Map<number, Pick<Voluntario, 'nombre' | 'celulares'>>
  tareas: Pick<Tarea, 'id' | 'nombre'>[]
}): Hoja {
  const enc = [o.proyecto.superintendenteNombre.trim(), formatoCelular(o.proyecto.superintendenteCelular)].filter(Boolean).join(' · ')
  return {
    proyecto: nombreProyecto(o.proyecto),
    fecha: fechaLarga(o.fecha),
    direccion: o.proyecto.direccion.trim(),
    encargado: enc,
    jornadas: o.jornadas.map((j) => {
      const lista = o.programaciones
        .filter((p) => p.jornada === j && ocupaCupo(p))
        .map((p) => {
          const v = o.voluntarios.get(p.voluntarioId)
          return { ...p, nombre: v?.nombre ?? '(sin nombre)', celular: v ? formatoCelular(celularPrincipal(v)) : '' }
        })
      return {
        jornada: j,
        titulo: NOMBRE_JORNADA[j],
        horario: horarioTexto(o.proyecto, j),
        total: lista.length,
        cupo: cupoGeneral(o.dia, j),
        grupos: agruparPorTarea(lista, o.tareas).map((g) => ({
          tarea: g.tarea?.nombre ?? 'Sin tarea asignada',
          personas: g.items.map((p) => ({ nombre: p.nombre, celular: p.celular, confirmado: p.confirmacion === 'confirmado' })),
        })),
      }
    }),
  }
}

export function nombreArchivoHoja(fecha: string, ext: 'png' | 'pdf'): string {
  return `programacion-${fecha}.${ext}`
}
