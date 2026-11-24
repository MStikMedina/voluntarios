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
