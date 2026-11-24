// Tipos del modelo de datos (PLAN.md §4).

/** Jornada de trabajo: Mañana o Tarde. */
export type Jornada = 'M' | 'T'
/** Turno de disponibilidad: Mañana, Tarde o Día completo (D = M + T). */
export type Turno = Jornada | 'D'
/** Disponibilidad semanal: índice 0 = domingo … 6 = sábado. null = no disponible. */
export type Disponibilidad = (Turno | null)[]

export interface Horario {
  inicio: string // 'HH:MM'
  fin: string // 'HH:MM'
}
export type Jornadas = Record<Jornada, Horario>

export interface Proyecto {
  id: 1
  nombre: string
  ciudad: string
  direccion: string
  fechaInicio: string // 'YYYY-MM-DD' o ''
  fechaFin: string
  superintendenteNombre: string
  superintendenteCelular: string
  diasTrabajo: number[] // 0 = dom … 6 = sáb
  jornadas: Jornadas
  edadMenor: number
  edadMayor: number
  frecuenciaRespaldo: 'diario'
  ultimoRespaldo?: string // ISO fecha-hora
  ultimoCambio?: string // ISO fecha-hora
}

export interface Congregacion {
  id: number
  nombre: string
  numero: string
  coordinadorNombre: string
  coordinadorCelular: string
  otroContactoNombre: string
  otroContactoCelular: string
}

export interface Celular {
  numero: string // 10 dígitos
  principal: boolean
}

export type TipoVoluntario = 'Local' | 'A-2'

export interface Voluntario {
  id: number
  nombre: string
  nombreNorm: string // lo calcula la base de datos al guardar
  congregacionId: number | null
  invitado: boolean
  invitadoMotivo: string
  invitadoPor: string
  tipo: TipoVoluntario
  fechaNacimiento: string // 'YYYY-MM-DD' o ''
  profesion: string
  profesionNorm: string // lo calcula la base de datos al guardar
  celulares: Celular[]
  emergenciaNombre: string
  emergenciaCelular: string
  disponibilidad: Disponibilidad
  tareaHabitualId?: number | null
  observaciones: string
  creado: string // ISO fecha-hora
  actualizado: string
}

/** Lo que hay que dar para crear un voluntario (id, *Norm y fechas los pone la app). */
export type NuevoVoluntario = Omit<
  Voluntario,
  'id' | 'nombreNorm' | 'profesionNorm' | 'creado' | 'actualizado'
>

export type EstadoTarea = 'pendiente' | 'en_curso' | 'terminada'

export interface Tarea {
  id: number
  nombre: string
  descripcion: string
  fechaInicio: string
  fechaFin: string
  estado: EstadoTarea
  personasNecesarias: number
  habilidadRequerida: string
}

export interface Dia {
  fecha: string // PK 'YYYY-MM-DD'
  cupoM?: number | null
  cupoT?: number | null
  cuposTarea: Record<number, number>
  notas: string
}

export type Confirmacion = 'pendiente' | 'confirmado' | 'no_puede'

export interface Programacion {
  id: number
  fecha: string
  jornada: Jornada
  voluntarioId: number
  tareaId?: number | null
  confirmacion: Confirmacion
  mensajeEnviado: boolean
}

export interface Asistencia {
  id: number
  fecha: string
  jornada: Jornada
  voluntarioId: number
  asistio: boolean
  horaLlegada?: string // 'HH:MM'
  horaSalida?: string
  tareaId?: number | null
  tareaTexto?: string
  observacion: string
}

export interface Plantilla {
  id: number
  nombre: string
  texto: string
}
