// Congregaciones (PLAN.md §2.3): formulario, validación, duplicados y borrado seguro.
import type { Congregacion } from '../db/tipos'
import type { BaseVoluntarios } from '../db/db'
import { formatoCelular, limpiarCelular, validarCelular } from './telefono'
import { normalizar } from './texto'

export type DatosCongregacion = Omit<Congregacion, 'id'>

export interface FormCongregacion {
  nombre: string
  numero: string
  coordinadorNombre: string
  coordinadorCelular: string
  otroContactoNombre: string
  otroContactoCelular: string
}

export type ErroresCongregacion = Partial<
  Record<'nombre' | 'numero' | 'coordinadorCelular' | 'otroContactoCelular', string>
>

export const FORM_CONGREGACION_VACIO: FormCongregacion = {
  nombre: '',
  numero: '',
  coordinadorNombre: '',
  coordinadorCelular: '',
  otroContactoNombre: '',
  otroContactoCelular: '',
}

export function congregacionAForm(c: DatosCongregacion): FormCongregacion {
  return {
    nombre: c.nombre,
    numero: c.numero,
    coordinadorNombre: c.coordinadorNombre,
    coordinadorCelular: formatoCelular(c.coordinadorCelular),
    otroContactoNombre: c.otroContactoNombre,
    otroContactoCelular: formatoCelular(c.otroContactoCelular),
  }
}

/** Lo que se guarda: textos recortados y espacios repetidos quitados; celulares solo con dígitos. */
export function formACongregacion(f: FormCongregacion): DatosCongregacion {
  const limpio = (t: string) => t.replace(/\s+/g, ' ').trim()
  return {
    nombre: limpio(f.nombre),
    numero: f.numero.replace(/\s+/g, ''),
    coordinadorNombre: limpio(f.coordinadorNombre),
    coordinadorCelular: limpiarCelular(f.coordinadorCelular),
    otroContactoNombre: limpio(f.otroContactoNombre),
    otroContactoCelular: limpiarCelular(f.otroContactoCelular),
  }
}

const MSJ_CELULAR = 'Debe tener 10 dígitos y empezar por 3 (300 123 4567).'

export function validarCongregacion(f: FormCongregacion): ErroresCongregacion {
  const e: ErroresCongregacion = {}
  if (!f.nombre.trim()) e.nombre = 'Escriba el nombre de la congregación.'
  if (f.numero.trim() && !/^\d{1,8}$/.test(f.numero.replace(/\s+/g, ''))) e.numero = 'Solo números.'
  if (f.coordinadorCelular.trim() && !validarCelular(f.coordinadorCelular)) e.coordinadorCelular = MSJ_CELULAR
  if (f.otroContactoCelular.trim() && !validarCelular(f.otroContactoCelular)) e.otroContactoCelular = MSJ_CELULAR
  return e
}

/** Congregaciones (distintas de `idPropio`) con el mismo nombre o el mismo número. Solo avisa. */
export function duplicadosCongregacion(
  datos: Pick<DatosCongregacion, 'nombre' | 'numero'>,
  todas: Congregacion[],
  idPropio?: number,
): { nombre?: Congregacion; numero?: Congregacion } {
  const nombre = normalizar(datos.nombre)
  const numero = datos.numero.trim()
  const otras = todas.filter((c) => c.id !== idPropio)
  return {
    nombre: nombre ? otras.find((c) => normalizar(c.nombre) === nombre) : undefined,
    numero: numero ? otras.find((c) => c.numero.trim() === numero) : undefined,
  }
}

/** Orden alfabético (sin importar tildes ni mayúsculas). */
export function ordenarCongregaciones<T extends Pick<Congregacion, 'nombre'>>(lista: T[]): T[] {
  return [...lista].sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre), 'es'))
}

export class CongregacionConVoluntarios extends Error {
  cantidad: number
  constructor(cantidad: number) {
    super(`La congregación tiene ${cantidad} voluntario(s). Reasígnelos antes de eliminarla.`)
    this.name = 'CongregacionConVoluntarios'
    this.cantidad = cantidad
  }
}

/** Borra la congregación solo si no tiene voluntarios (si tiene, lanza CongregacionConVoluntarios). */
export async function eliminarCongregacion(db: BaseVoluntarios, id: number): Promise<void> {
  await db.transaction('rw', db.congregaciones, db.voluntarios, async () => {
    const cantidad = await db.voluntarios.where('congregacionId').equals(id).count()
    if (cantidad > 0) throw new CongregacionConVoluntarios(cantidad)
    await db.congregaciones.delete(id)
  })
}

/** Pasa todos los voluntarios de una congregación a otra. Devuelve cuántos se movieron. */
export async function reasignarVoluntarios(db: BaseVoluntarios, desde: number, hacia: number): Promise<number> {
  if (desde === hacia) return 0
  return db.transaction('rw', db.congregaciones, db.voluntarios, async () => {
    if (!(await db.congregaciones.get(hacia))) throw new Error('La congregación de destino no existe.')
    const ahora = new Date().toISOString()
    return db.voluntarios
      .where('congregacionId')
      .equals(desde)
      .modify({ congregacionId: hacia, actualizado: ahora })
  })
}
