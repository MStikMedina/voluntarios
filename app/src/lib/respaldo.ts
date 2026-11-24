// Respaldo y restauración (PLAN.md §2.13): un archivo JSON con todas las tablas.
import type { BaseVoluntarios } from '../db/db'
import { PROYECTO_POR_DEFECTO } from '../db/db'
import type {
  Asistencia, Congregacion, Dia, Plantilla, Programacion, Proyecto, Tarea, Voluntario,
} from '../db/tipos'
import { aISO, deISO, hoyISO } from './fechas'

export const APP_RESPALDO = 'voluntarios'
export const VERSION_RESPALDO = 1

export interface DatosRespaldo {
  proyecto: Proyecto
  congregaciones: Congregacion[]
  voluntarios: Voluntario[]
  tareas: Tarea[]
  dias: Dia[]
  programaciones: Programacion[]
  asistencias: Asistencia[]
  plantillas: Plantilla[]
}

export interface Respaldo {
  app: typeof APP_RESPALDO
  version: number
  creado: string // ISO fecha-hora
  datos: DatosRespaldo
}

export const TABLAS = [
  'congregaciones', 'voluntarios', 'tareas', 'dias', 'programaciones', 'asistencias', 'plantillas',
] as const
export type TablaRespaldo = (typeof TABLAS)[number]

export const NOMBRES_TABLA: Record<TablaRespaldo, string> = {
  congregaciones: 'Congregaciones',
  voluntarios: 'Voluntarios',
  tareas: 'Tareas',
  dias: 'Días con cupo',
  programaciones: 'Programaciones',
  asistencias: 'Asistencias',
  plantillas: 'Plantillas',
}

export type Conteos = Record<TablaRespaldo, number>

export async function crearRespaldo(db: BaseVoluntarios, ahora = new Date()): Promise<Respaldo> {
  return db.transaction('r', [db.proyecto, ...TABLAS.map((t) => db[t])], async () => {
    const [proyecto, congregaciones, voluntarios, tareas, dias, programaciones, asistencias, plantillas] =
      await Promise.all([
        db.obtenerProyecto(),
        db.congregaciones.toArray(),
        db.voluntarios.toArray(),
        db.tareas.toArray(),
        db.dias.toArray(),
        db.programaciones.toArray(),
        db.asistencias.toArray(),
        db.plantillas.toArray(),
      ])
    return {
      app: APP_RESPALDO,
      version: VERSION_RESPALDO,
      creado: ahora.toISOString(),
      datos: { proyecto, congregaciones, voluntarios, tareas, dias, programaciones, asistencias, plantillas },
    }
  })
}

export function nombreArchivoRespaldo(fecha: string = hoyISO()): string {
  return `voluntarios-respaldo-${fecha}.json`
}

export function respaldoABlob(r: Respaldo): Blob {
  return new Blob([JSON.stringify(r, null, 1)], { type: 'application/json' })
}

export function contar(d: Pick<DatosRespaldo, TablaRespaldo>): Conteos {
  return Object.fromEntries(TABLAS.map((t) => [t, d[t].length])) as Conteos
}

export async function contarBase(db: BaseVoluntarios): Promise<Conteos> {
  const n = await Promise.all(TABLAS.map((t) => db[t].count()))
  return Object.fromEntries(TABLAS.map((t, i) => [t, n[i]])) as Conteos
}

export class RespaldoInvalido extends Error {
  constructor(msj: string) {
    super(msj)
    this.name = 'RespaldoInvalido'
  }
}

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

/** Lee y valida el texto de un archivo de respaldo. Lanza RespaldoInvalido con un mensaje claro. */
export function leerRespaldo(texto: string): Respaldo {
  let json: unknown
  try {
    json = JSON.parse(texto.replace(/^﻿/, ''))
  } catch {
    throw new RespaldoInvalido('El archivo no es un respaldo válido (no se pudo leer el JSON).')
  }
  if (!esObj(json) || json.app !== APP_RESPALDO || !esObj(json.datos)) {
    throw new RespaldoInvalido('Este archivo no es un respaldo de la app Voluntarios.')
  }
  if (typeof json.version !== 'number' || json.version > VERSION_RESPALDO) {
    throw new RespaldoInvalido('El respaldo es de una versión más nueva de la app. Actualice la app e intente de nuevo.')
  }
  const d = json.datos
  for (const t of TABLAS) {
    if (d[t] === undefined) d[t] = []
    if (!Array.isArray(d[t])) throw new RespaldoInvalido(`El respaldo está dañado (${NOMBRES_TABLA[t]}).`)
    const clave = t === 'dias' ? 'fecha' : 'id'
    for (const fila of d[t] as unknown[]) {
      if (!esObj(fila) || fila[clave] === undefined || fila[clave] === null) {
        throw new RespaldoInvalido(`El respaldo está dañado (${NOMBRES_TABLA[t]} sin identificador).`)
      }
    }
  }
  const proyecto = esObj(d.proyecto) ? d.proyecto : {}
  return {
    app: APP_RESPALDO,
    version: json.version,
    creado: typeof json.creado === 'string' ? json.creado : '',
    datos: { ...(d as unknown as DatosRespaldo), proyecto: { ...PROYECTO_POR_DEFECTO, ...proyecto, id: 1 } as Proyecto },
  }
}

export type ModoRestaurar = 'reemplazar' | 'combinar'

/**
 * Reemplazar: borra todo y deja exactamente lo del respaldo.
 * Combinar: agrega o actualiza cada registro según su id (lo que no está en el respaldo se conserva).
 */
export async function restaurarRespaldo(db: BaseVoluntarios, r: Respaldo, modo: ModoRestaurar): Promise<void> {
  const local = await db.obtenerProyecto()
  await db.transaction('rw', [db.proyecto, ...TABLAS.map((t) => db[t])], async () => {
    if (modo === 'reemplazar') {
      for (const t of TABLAS) await db[t].clear()
    }
    for (const t of TABLAS) {
      if (r.datos[t].length) await db.table(t).bulkPut(r.datos[t])
    }
    // El proyecto viene del respaldo; las marcas de respaldo son las de este dispositivo.
    await db.proyecto.put({
      ...r.datos.proyecto,
      id: 1,
      ultimoRespaldo: local.ultimoRespaldo,
      ultimoCambio: new Date().toISOString(),
    })
  })
  await db.ultimaMarca
  if (modo === 'reemplazar') {
    // Los datos quedan iguales al archivo: no hay cambios pendientes de respaldar.
    await db.guardarProyecto({ ultimoRespaldo: new Date(Date.now() + 1).toISOString() })
  }
}

/** Días calendario entre dos fechas-hora ISO (en hora local). */
function diasEntre(desdeISO: string, hasta: Date): number {
  const a = deISO(aISO(new Date(desdeISO))).getTime()
  const b = deISO(aISO(hasta)).getTime()
  return Math.round((b - a) / 86_400_000)
}

/**
 * ¿Hay que recordar el respaldo? Solo si hubo cambios después del último respaldo y ya pasó
 * un día (diario) o una semana (semanal) desde ese respaldo. Sin respaldo previo: sí, si hubo cambios.
 */
export function respaldoPendiente(
  p: Pick<Proyecto, 'ultimoCambio' | 'ultimoRespaldo' | 'frecuenciaRespaldo'>,
  ahora: Date = new Date(),
): boolean {
  if (!p.ultimoCambio) return false
  if (!p.ultimoRespaldo) return true
  if (p.ultimoCambio <= p.ultimoRespaldo) return false
  return diasEntre(p.ultimoRespaldo, ahora) >= (p.frecuenciaRespaldo === 'semanal' ? 7 : 1)
}

/** ¿Hay cambios sin respaldar (sin importar la frecuencia)? */
export function cambiosSinRespaldar(p: Pick<Proyecto, 'ultimoCambio' | 'ultimoRespaldo'>): boolean {
  if (!p.ultimoCambio) return false
  return !p.ultimoRespaldo || p.ultimoCambio > p.ultimoRespaldo
}
