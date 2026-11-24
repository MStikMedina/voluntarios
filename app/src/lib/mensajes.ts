// Mensajes de WhatsApp (PLAN.md §2.5): variables de plantillas y texto de la programación.
import type { Jornada, Programacion, Proyecto, Tarea, Voluntario } from '../db/tipos'
import { fechaLarga, formatoHora } from './fechas'
import { rellenarPlantilla, type VariablesPlantilla } from './plantillas'
import { agruparPorTarea, NOMBRE_JORNADA, ocupaCupo } from './programacion'
import { formatoCelular } from './telefono'
import { celularPrincipal } from './voluntarios'

export const VARIABLES: { clave: keyof VariablesPlantilla; texto: string }[] = [
  { clave: 'nombre', texto: 'Primer nombre del voluntario' },
  { clave: 'fecha', texto: 'Fecha (sábado 05/12/2026)' },
  { clave: 'jornada', texto: 'mañana o tarde' },
  { clave: 'hora', texto: 'Horario de la jornada' },
  { clave: 'tarea', texto: 'Tarea asignada' },
  { clave: 'proyecto', texto: 'Nombre del proyecto' },
]

export const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] ?? ''

export function horarioTexto(p: Pick<Proyecto, 'jornadas'>, j: Jornada): string {
  return `${formatoHora(p.jornadas[j].inicio)} a ${formatoHora(p.jornadas[j].fin)}`
}

export function nombreProyecto(p: Pick<Proyecto, 'nombre'>): string {
  return p.nombre.trim() || 'la remodelación del Salón del Reino'
}

/** Valores de las variables para un voluntario (y, si se da, una fecha y jornada programadas). */
export function variablesMensaje(o: {
  voluntario: Pick<Voluntario, 'nombre'>
  proyecto: Pick<Proyecto, 'nombre' | 'jornadas'>
  fecha?: string
  jornada?: Jornada
  tarea?: Pick<Tarea, 'nombre'> | null
}): VariablesPlantilla {
  return {
    nombre: primerNombre(o.voluntario.nombre),
    proyecto: nombreProyecto(o.proyecto),
    fecha: o.fecha ? fechaLarga(o.fecha) : '…',
    jornada: o.jornada ? NOMBRE_JORNADA[o.jornada].toLowerCase() : '…',
    hora: o.jornada ? horarioTexto(o.proyecto, o.jornada) : '…',
    tarea: o.tarea?.nombre ?? 'por asignar',
  }
}

export function mensajeDePlantilla(texto: string, vars: VariablesPlantilla): string {
  return rellenarPlantilla(texto, vars)
}

/**
 * Texto de la programación del día para WhatsApp: encabezado con proyecto y fecha,
 * separado por jornada, agrupado por tarea y con celulares. No incluye a quienes «no pueden».
 */
export function textoProgramacion(o: {
  proyecto: Pick<Proyecto, 'nombre' | 'jornadas' | 'direccion'>
  fecha: string
  jornadas: Jornada[]
  programaciones: Pick<Programacion, 'jornada' | 'voluntarioId' | 'tareaId' | 'confirmacion'>[]
  voluntarios: Map<number, Pick<Voluntario, 'nombre' | 'celulares'>>
  tareas: Pick<Tarea, 'id' | 'nombre'>[]
  celulares?: boolean
}): string {
  const lineas: string[] = []
  lineas.push(`*${nombreProyecto(o.proyecto)}*`)
  lineas.push(`📅 *Programación ${fechaLarga(o.fecha)}*`)
  if (o.proyecto.direccion.trim()) lineas.push(`📍 ${o.proyecto.direccion.trim()}`)
  for (const j of o.jornadas) {
    const lista = o.programaciones
      .filter((p) => p.jornada === j && ocupaCupo(p))
      .map((p) => {
        const v = o.voluntarios.get(p.voluntarioId)
        return { ...p, nombre: v?.nombre ?? '(sin nombre)', celular: v ? celularPrincipal(v) : '' }
      })
    lineas.push('')
    lineas.push(`*${NOMBRE_JORNADA[j].toUpperCase()}* (${horarioTexto(o.proyecto, j)}) — ${lista.length} ${lista.length === 1 ? 'persona' : 'personas'}`)
    if (!lista.length) {
      lineas.push('_Nadie programado_')
      continue
    }
    for (const g of agruparPorTarea(lista, o.tareas)) {
      lineas.push(`▪ _${g.tarea?.nombre ?? 'Sin tarea asignada'}_`)
      for (const p of g.items) {
        const cel = o.celulares !== false && p.celular ? ` – ${formatoCelular(p.celular)}` : ''
        lineas.push(`   • ${p.nombre}${p.confirmacion === 'confirmado' ? ' ✅' : ''}${cel}`)
      }
    }
  }
  return lineas.join('\n')
}
