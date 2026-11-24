import Dexie, { type EntityTable } from 'dexie'
import type {
  Asistencia, Congregacion, Dia, Plantilla, Programacion, Proyecto, Tarea, Voluntario,
} from './tipos'
import { normalizar } from '../lib/texto'

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

export class BaseVoluntarios extends Dexie {
  proyecto!: EntityTable<Proyecto, 'id'>
  congregaciones!: EntityTable<Congregacion, 'id'>
  voluntarios!: EntityTable<Voluntario, 'id'>
  tareas!: EntityTable<Tarea, 'id'>
  dias!: EntityTable<Dia, 'fecha'>
  programaciones!: EntityTable<Programacion, 'id'>
  asistencias!: EntityTable<Asistencia, 'id'>
  plantillas!: EntityTable<Plantilla, 'id'>

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

    // Al crear la base por primera vez: proyecto con valores por defecto y plantillas iniciales.
    this.on('populate', async (tx) => {
      await tx.table('proyecto').add({ ...PROYECTO_POR_DEFECTO })
      await tx.table('plantillas').bulkAdd(PLANTILLAS_INICIALES.map((p) => ({ ...p })))
    })

    // Middleware: en cada escritura (fuera de la tabla proyecto) calcula los campos *Norm
    // de los voluntarios y marca proyecto.ultimoCambio para el recordatorio de respaldo.
    this.use({
      stack: 'dbcore',
      name: 'normalizarYMarcarCambio',
      create: (abajo) => ({
        ...abajo,
        table: (nombreTabla) => {
          const tabla = abajo.table(nombreTabla)
          if (nombreTabla === 'proyecto') return tabla
          return {
            ...tabla,
            mutate: async (req) => {
              if (nombreTabla === 'voluntarios' && (req.type === 'add' || req.type === 'put')) {
                req = {
                  ...req,
                  values: req.values.map((v: Voluntario) => ({
                    ...v,
                    nombreNorm: normalizar(v.nombre),
                    profesionNorm: normalizar(v.profesion),
                  })),
                }
              }
              const res = await tabla.mutate(req)
              // La creación de la base (populate/upgrade) no cuenta como cambio del usuario.
              if ((req.trans as unknown as IDBTransaction).mode !== 'versionchange') this.marcarCambio()
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
