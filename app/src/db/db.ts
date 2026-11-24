import Dexie, { type EntityTable, type Table, type Transaction } from 'dexie'
import type {
  Asistencia, Congregacion, Dia, Plantilla, Programacion, Proyecto, Tarea, Voluntario,
} from './tipos'
import { normalizar } from '../lib/texto'

/** Tablas que se sincronizan con la nube. */
export const TABLAS_SINC = [
  'proyecto', 'congregaciones', 'voluntarios', 'tareas', 'dias', 'programaciones', 'asistencias', 'plantillas',
] as const
export type TablaSinc = (typeof TABLAS_SINC)[number]
const ES_SINC = new Set<string>(TABLAS_SINC)

/** Campos del proyecto que son de cada dispositivo (no se suben a la nube). */
export const CAMPOS_LOCALES_PROYECTO = ['ultimoCambio', 'ultimoRespaldo'] as const

export function sinCamposLocales(p: Partial<Proyecto>): Partial<Proyecto> {
  const copia = { ...p }
  for (const c of CAMPOS_LOCALES_PROYECTO) delete copia[c]
  return copia
}

/** Registro cambiado en este dispositivo que falta subir a la nube. */
export interface Pendiente {
  tabla: TablaSinc
  clave: number | string
  momento: string // cambia en cada modificación: sirve para saber si se volvió a tocar mientras se subía
}

/** Datos internos de la sincronización (cursor, si ya se inicializó…). */
export interface RegistroSinc {
  clave: string
  valor: unknown
}

// Ids que no chocan entre dispositivos: segundos desde 2026 × 2^20 + un número al azar.
// Caben de sobra en un Number (seguro hasta dentro de unos 270 años) y crecen con el tiempo.
const EPOCA_IDS = Date.UTC(2026, 0, 1) / 1000
let ultimoId = 0
export function nuevoId(): number {
  const base = (Math.floor(Date.now() / 1000) - EPOCA_IDS) * 2 ** 20 + Math.floor(Math.random() * 2 ** 20)
  ultimoId = Math.max(base, ultimoId + 1)
  return ultimoId
}

let contadorMomento = 0
const nuevoMomento = () => `${Date.now()}-${++contadorMomento}-${Math.random().toString(36).slice(2, 6)}`

type ConMarca = { __sincRemota?: boolean }

/** Marca una transacción como "viene de la nube": sus escrituras no se vuelven a subir. */
export function marcarRemota(tx: Transaction) {
  ;(tx as unknown as ConMarca).__sincRemota = true
  ;(tx.idbtrans as unknown as ConMarca).__sincRemota = true
}

function esRemota(trans: unknown): boolean {
  return !!(trans as ConMarca)?.__sincRemota || !!(Dexie.currentTransaction as unknown as ConMarca)?.__sincRemota
}

/** JSON con las claves ordenadas: para comparar objetos sin importar el orden de los campos. */
export function jsonEstable(v: unknown): string {
  return JSON.stringify(v, (_k, x) =>
    x && typeof x === 'object' && !Array.isArray(x)
      ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, (x as Record<string, unknown>)[k]]))
      : x,
  )
}

export const PROYECTO_POR_DEFECTO: Proyecto = {
  id: 1,
  nombre: '',
  ciudad: '',
  direccion: '',
  fechaInicio: '',
  fechaFin: '',
  superintendenteNombre: '',
  superintendenteCelular: '',
  diasTrabajo: [6], // sábado
  jornadas: { M: { inicio: '07:00', fin: '12:00' }, T: { inicio: '13:00', fin: '17:00' } },
  edadMenor: 18,
  edadMayor: 65,
  frecuenciaRespaldo: 'diario',
}

export const PLANTILLAS_INICIALES: Omit<Plantilla, 'id'>[] = [
  {
    nombre: 'Recordatorio de jornada',
    texto:
      'Hola {nombre}, le recordamos que está programado(a) para la remodelación del Salón del Reino el {fecha} en la jornada de la {jornada} ({hora}). Tarea: {tarea}. ¡Muchas gracias!',
  },
  {
    nombre: 'Confirmar asistencia',
    texto:
      'Hola {nombre}, ¿nos confirma si puede acompañarnos el {fecha} en la jornada de la {jornada} ({hora}) para {proyecto}? Gracias.',
  },
  {
    nombre: 'Agradecimiento',
    texto:
      'Hola {nombre}, muchas gracias por su apoyo en {proyecto}. Su trabajo es muy valioso.',
  },
  { nombre: 'Mensaje libre', texto: 'Hola {nombre}, ' },
]

/** Plantillas iniciales con ids fijos 1, 2, 3… */
export function plantillasIniciales(): Plantilla[] {
  return PLANTILLAS_INICIALES.map((p, i) => ({ ...p, id: i + 1 }))
}

export class BaseVoluntarios extends Dexie {
  proyecto!: EntityTable<Proyecto, 'id'>
  congregaciones!: EntityTable<Congregacion, 'id'>
  voluntarios!: EntityTable<Voluntario, 'id'>
  tareas!: EntityTable<Tarea, 'id'>
  dias!: EntityTable<Dia, 'fecha'>
  programaciones!: EntityTable<Programacion, 'id'>
  asistencias!: EntityTable<Asistencia, 'id'>
  plantillas!: EntityTable<Plantilla, 'id'>
  pendientes!: Table<Pendiente, [string, number | string]>
  sinc!: EntityTable<RegistroSinc, 'clave'>

  /** Se llama cuando hay cambios nuevos por subir (la sincronización lo usa). */
  alHaberPendientes: (() => void) | null = null

  constructor(nombre = 'voluntarios') {
    super(nombre)
    this.version(1).stores({
      proyecto: 'id',
      congregaciones: '++id, nombre',
      voluntarios: '++id, nombreNorm, congregacionId, tareaHabitualId',
      tareas: '++id, estado',
      dias: 'fecha',
      programaciones: '++id, [fecha+jornada], fecha, voluntarioId, tareaId',
      asistencias: '++id, [fecha+jornada], fecha, voluntarioId, tareaId',
      plantillas: '++id',
    })
    // v2: sincronización con la nube.
    this.version(2).stores({
      pendientes: '[tabla+clave]',
      sinc: 'clave',
    })

    // Al crear la base por primera vez: proyecto con valores por defecto y plantillas iniciales
    // (con ids fijos, para que sean las mismas en todos los dispositivos).
    this.on('populate', async (tx) => {
      await tx.table('proyecto').add({ ...PROYECTO_POR_DEFECTO })
      await tx.table('plantillas').bulkAdd(plantillasIniciales())
    })

    // Middleware en cada escritura:
    // - pone ids que no chocan entre dispositivos,
    // - calcula los campos *Norm de los voluntarios,
    // - anota el registro en `pendientes` para subirlo a la nube (salvo si viene de la nube),
    // - marca proyecto.ultimoCambio para el recordatorio de respaldo.
    this.use({
      stack: 'dbcore',
      name: 'sincronizacion',
      create: (abajo) => ({
        ...abajo,
        // Toda transacción de escritura sobre tablas sincronizadas incluye `pendientes`,
        // así el cambio y su anotación se guardan juntos (o ninguno).
        transaction: (tablas, modo, opciones) =>
          abajo.transaction(
            modo === 'readwrite' && tablas.some((t) => ES_SINC.has(t)) && !tablas.includes('pendientes')
              ? [...tablas, 'pendientes']
              : tablas,
            modo,
            opciones,
          ),
        table: (nombreTabla) => {
          const tabla = abajo.table(nombreTabla)
          if (!ES_SINC.has(nombreTabla)) return tabla
          const pk = tabla.schema.primaryKey
          const campoClave = pk.keyPath as string
          return {
            ...tabla,
            mutate: async (req) => {
              if (req.type === 'add' || req.type === 'put') {
                let values = req.values
                if (pk.autoIncrement) {
                  values = values.map((v) => (v[campoClave] == null ? { ...v, [campoClave]: nuevoId() } : v))
                }
                if (nombreTabla === 'voluntarios') {
                  values = values.map((v: Voluntario) => ({
                    ...v,
                    nombreNorm: normalizar(v.nombre),
                    profesionNorm: normalizar(v.profesion),
                  }))
                }
                req = { ...req, values }
              }

              const creandoBase = (req.trans as unknown as IDBTransaction).mode === 'versionchange'
              const anotar = !creandoBase && !esRemota(req.trans)
              let claves: unknown[] = []
              if (anotar) {
                if (req.type === 'delete') claves = [...req.keys]
                else if (req.type === 'deleteRange') {
                  const r = await tabla.query({ trans: req.trans, values: false, query: { index: pk, range: req.range } })
                  claves = r.result
                } else if (nombreTabla === 'proyecto') {
                  // Solo cuenta si cambió algo que se comparte (no las marcas de respaldo).
                  for (const v of req.values) {
                    const antes = await tabla.get({ trans: req.trans, key: v[campoClave] })
                    if (!antes || jsonEstable(sinCamposLocales(antes)) !== jsonEstable(sinCamposLocales(v))) {
                      claves.push(v[campoClave])
                    }
                  }
                } else claves = req.values.map((v) => v[campoClave])
              }

              const res = await tabla.mutate(req)

              if (claves.length) {
                await abajo.table('pendientes').mutate({
                  type: 'put',
                  trans: req.trans,
                  values: claves.map((clave) => ({ tabla: nombreTabla, clave, momento: nuevoMomento() })),
                })
                this.alHaberPendientes?.()
              }
              // La creación de la base y lo que llega de la nube no cuentan como cambio del usuario.
              if (anotar && nombreTabla !== 'proyecto') this.marcarCambio()
              return res
            },
          }
        },
      }),
    })
  }

  private cambioProgramado: ReturnType<typeof setTimeout> | null = null
  /** Promesa de la última marca de cambio (útil en pruebas). */
  ultimaMarca: Promise<void> = Promise.resolve()

  /** Guarda proyecto.ultimoCambio fuera de la transacción en curso (agrupa ráfagas). */
  marcarCambio() {
    if (this.cambioProgramado) return
    this.ultimaMarca = new Promise((resolver) => {
      this.cambioProgramado = setTimeout(async () => {
        this.cambioProgramado = null
        try {
          await this.proyecto.update(1, { ultimoCambio: new Date().toISOString() })
        } catch (e) {
          console.warn('No se pudo marcar el último cambio', e)
        } finally {
          resolver()
        }
      }, 0)
    })
  }

  /** Proyecto guardado (o los valores por defecto si aún no existe). */
  async obtenerProyecto(): Promise<Proyecto> {
    return (await this.proyecto.get(1)) ?? { ...PROYECTO_POR_DEFECTO }
  }

  /** Guarda cambios del proyecto y marca el cambio (salvo que solo se toque el respaldo). */
  async guardarProyecto(cambios: Partial<Omit<Proyecto, 'id'>>) {
    const actual = await this.obtenerProyecto()
    const soloRespaldo = Object.keys(cambios).every((k) => k === 'ultimoRespaldo')
    await this.proyecto.put({
      ...actual,
      ...cambios,
      id: 1,
      ...(soloRespaldo ? {} : { ultimoCambio: new Date().toISOString() }),
    })
  }
}

export const db = new BaseVoluntarios()
