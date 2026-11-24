import type { BaseVoluntarios } from '../db/db'
import { PLANTILLAS_INICIALES } from '../db/db'
import { normalizar } from './texto'

export type VariablesPlantilla = Partial<
  Record<'nombre' | 'fecha' | 'jornada' | 'hora' | 'tarea' | 'proyecto', string>
>

/** Reemplaza {variable} por su valor. Las variables sin valor quedan como están. */
export function rellenarPlantilla(texto: string, variables: VariablesPlantilla): string {
  return texto.replace(/\{(\w+)\}/g, (todo, clave: string) => {
    const v = variables[clave as keyof VariablesPlantilla]
    return v === undefined ? todo : v
  })
}


/** Vuelve a agregar las plantillas iniciales que falten (por nombre). Devuelve cuántas agregó. */
export async function restaurarPlantillasIniciales(db: BaseVoluntarios): Promise<number> {
  const actuales = new Set((await db.plantillas.toArray()).map((p) => normalizar(p.nombre)))
  const faltan = PLANTILLAS_INICIALES.filter((p) => !actuales.has(normalizar(p.nombre)))
  if (faltan.length) await db.plantillas.bulkAdd(faltan.map((p) => ({ ...p })) as never)
  return faltan.length
}
