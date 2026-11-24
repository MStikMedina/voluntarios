// Carga masiva de voluntarios (PLAN.md §2.12): plantilla, lectura de texto/CSV/Excel,
// validación por fila, duplicados y congregaciones que faltan.
import type { BaseVoluntarios } from '../db/db'
import type { Congregacion, NuevoVoluntario, Voluntario } from '../db/tipos'
import { codigosDisponibilidad, parsearCodigosDisponibilidad } from './disponibilidad'
import { edad, esFechaISO, hoyISO, parsearFecha } from './fechas'
import { formatoCelular, limpiarCelular, validarCelular } from './telefono'
import { normalizar } from './texto'
import { duplicadosVoluntario } from './voluntarios'

export const COLUMNAS = [
  'Nombre',
  'Congregación',
  'Local/A-2',
  'Fecha nac. (dd/mm/aaaa)',
  'Profesión',
  'Contacto emergencia',
  'Cel. emergencia',
  'Celular(es)',
  'Disponibilidad',
  'Invitado',
  'Motivo',
  'Invitado por',
  'Observaciones',
] as const

type Campo =
  | 'nombre' | 'congregacion' | 'tipo' | 'fechaNac' | 'profesion' | 'emergenciaNombre' | 'emergenciaCelular'
  | 'celulares' | 'disponibilidad' | 'invitado' | 'motivo' | 'invitadoPor' | 'observaciones'

const CAMPOS: Campo[] = [
  'nombre', 'congregacion', 'tipo', 'fechaNac', 'profesion', 'emergenciaNombre', 'emergenciaCelular',
  'celulares', 'disponibilidad', 'invitado', 'motivo', 'invitadoPor', 'observaciones',
]

/** Cómo reconocer cada columna por su encabezado (normalizado, empieza por…). */
const ALIAS: Record<Campo, string[]> = {
  nombre: ['nombre'],
  congregacion: ['congregacion', 'cong'],
  tipo: ['local', 'tipo', 'vol. local', 'vol local'],
  fechaNac: ['fecha', 'nacimiento', 'fecha nac'],
  profesion: ['profesion', 'habilidad', 'oficio'],
  emergenciaNombre: ['contacto emergencia', 'contacto de emergencia', 'emergencia nombre', 'nombre emergencia'],
  emergenciaCelular: ['cel. emergencia', 'cel emergencia', 'celular emergencia', 'celular de emergencia', 'tel emergencia', 'telefono emergencia'],
  celulares: ['celular', 'celulares', 'cel', 'telefono', 'movil', 'whatsapp'],
  disponibilidad: ['disponibilidad', 'dias', 'disponible'],
  invitado: ['invitado'],
  motivo: ['motivo'],
  invitadoPor: ['invitado por', 'quien lo invito', 'invito'],
  observaciones: ['observ', 'notas', 'comentario'],
}

// --- Texto pegado / CSV ---

export type Separador = '\t' | ';' | ','
export const NOMBRE_SEPARADOR: Record<Separador, string> = { '\t': 'tabulación', ';': 'punto y coma', ',': 'coma' }

/** Divide una línea respetando comillas dobles ("a, b" es un solo campo). */
function dividirLinea(linea: string, sep: string): string[] {
  const res: string[] = []
  let actual = ''
  let comillas = false
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i]
    if (comillas) {
      if (c === '"' && linea[i + 1] === '"') {
        actual += '"'
        i++
      } else if (c === '"') comillas = false
      else actual += c
    } else if (c === '"' && actual.trim() === '') {
      comillas = true
      actual = ''
    } else if (c === sep) {
      res.push(actual)
      actual = ''
    } else actual += c
  }
  res.push(actual)
  return res
}

/** Une las líneas que quedaron partidas por un salto de línea dentro de comillas. */
function lineasLogicas(texto: string): string[] {
  const fisicas = texto.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n')
  const res: string[] = []
  let acumulada: string | null = null
  for (const l of fisicas) {
    const linea: string = acumulada === null ? l : `${acumulada}\n${l}`
    const comillas = (linea.match(/"/g) ?? []).length
    if (comillas % 2 === 1) acumulada = linea
    else {
      res.push(linea)
      acumulada = null
    }
  }
  if (acumulada !== null) res.push(acumulada)
  return res
}

/**
 * Detecta el separador: tabulación (copiar de Excel), punto y coma o coma.
 * Gana el que aparece en más líneas con el mismo número de columnas (y prioridad tab > ; > ,).
 */
export function detectarSeparador(texto: string): Separador {
  const lineas = lineasLogicas(texto).filter((l) => l.trim()).slice(0, 30)
  let mejor: Separador = '\t'
  let puntaje = -1
  for (const sep of ['\t', ';', ','] as Separador[]) {
    const columnas = lineas.map((l) => dividirLinea(l, sep).length)
    const conSep = columnas.filter((n) => n > 1)
    if (!conSep.length) continue
    const moda = [...new Set(conSep)]
      .map((n) => [n, conSep.filter((x) => x === n).length] as const)
      .sort((a, b) => b[1] - a[1])[0]
    const p = moda[1] * 100 + Math.min(moda[0], 20)
    if (p > puntaje) {
      puntaje = p
      mejor = sep
    }
  }
  return mejor
}

export function parsearTexto(texto: string, sep: Separador = detectarSeparador(texto)): string[][] {
  return lineasLogicas(texto)
    .filter((l) => l.trim())
    .map((l) => dividirLinea(l, sep).map((c) => c.trim()))
}

// --- Encabezados ---

/** Índice de columna de cada campo. Si la primera fila no parece encabezado, se usa el orden de la plantilla. */
export function mapearColumnas(primera: string[]): { indices: Partial<Record<Campo, number>>; tieneEncabezado: boolean } {
  const norm = primera.map((c) => normalizar(c).replace(/[()*]/g, '').trim())
  const indices: Partial<Record<Campo, number>> = {}
  const usados = new Set<number>()
  // Primero los alias más largos (p. ej. «cel. emergencia» antes que «cel»).
  const pares = CAMPOS.flatMap((campo) => ALIAS[campo].map((a) => ({ campo, a }))).sort((x, y) => y.a.length - x.a.length)
  for (const { campo, a } of pares) {
    if (indices[campo] !== undefined) continue
    const i = norm.findIndex((h, j) => !usados.has(j) && h && (h === a || h.startsWith(a)))
    if (i >= 0) {
      indices[campo] = i
      usados.add(i)
    }
  }
  if (indices.nombre !== undefined && Object.keys(indices).length >= 2) return { indices, tieneEncabezado: true }
  return { indices: Object.fromEntries(CAMPOS.map((c, i) => [c, i])), tieneEncabezado: false }
}

// --- Validación por fila ---

export interface FilaImportada {
  fila: number // número de fila en el archivo (1 = primera)
  datos: NuevoVoluntario
  /** Nombre de una congregación que no existe (se puede crear). */
  congregacionNueva?: string
  errores: string[]
  avisos: string[]
}

const SI = new Set(['si', 'sí', 's', 'x', '1', 'true', 'verdadero', 'yes', 'y'])

function leerTipo(t: string): 'Local' | 'A-2' | null {
  const n = normalizar(t).replace(/[\s-]/g, '')
  if (!n || n === 'local' || n === 'l') return 'Local'
  if (n === 'a2') return 'A-2'
  return null
}

/** Separa celulares por coma, punto y coma, barra, «y» o salto de línea. */
export function separarCelulares(t: string): string[] {
  return t
    .split(/[,;/|\n]|\s+y\s+|\s+o\s+/i)
    .map((x) => x.trim())
    .filter(Boolean)
}

export function analizarFilas(
  filas: string[][],
  congregaciones: Pick<Congregacion, 'id' | 'nombre' | 'numero'>[],
  existentes: Voluntario[],
  hoy: string = hoyISO(),
): { filas: FilaImportada[]; tieneEncabezado: boolean } {
  if (!filas.length) return { filas: [], tieneEncabezado: false }
  const { indices, tieneEncabezado } = mapearColumnas(filas[0])
  const cuerpo = tieneEncabezado ? filas.slice(1) : filas
  const desplazamiento = tieneEncabezado ? 2 : 1
  const valor = (f: string[], c: Campo) => {
    const i = indices[c]
    return i === undefined ? '' : (f[i] ?? '').toString().trim()
  }

  const porNombre = new Map(congregaciones.map((c) => [normalizar(c.nombre), c.id]))
  const porNumero = new Map(congregaciones.filter((c) => c.numero).map((c) => [c.numero.trim(), c.id]))

  const resultado: FilaImportada[] = []
  cuerpo.forEach((f, k) => {
    if (f.every((c) => !String(c ?? '').trim())) return // fila vacía
    const errores: string[] = []
    const avisos: string[] = []

    const nombre = valor(f, 'nombre').replace(/\s+/g, ' ')
    if (!nombre) errores.push('Falta el nombre.')

    const invitado = SI.has(normalizar(valor(f, 'invitado')))

    const congTexto = valor(f, 'congregacion').replace(/\s+/g, ' ')
    let congregacionId: number | null = null
    let congregacionNueva: string | undefined
    if (congTexto) {
      congregacionId = porNombre.get(normalizar(congTexto)) ?? porNumero.get(congTexto) ?? null
      if (congregacionId === null) congregacionNueva = congTexto
    } else if (!invitado) errores.push('Falta la congregación (o marque Invitado).')

    const tipo = leerTipo(valor(f, 'tipo'))
    if (!tipo) errores.push(`«${valor(f, 'tipo')}» no es Local ni A-2.`)

    const fechaTexto = valor(f, 'fechaNac')
    let fechaNacimiento = ''
    if (fechaTexto) {
      const iso = esFechaISO(fechaTexto) ? fechaTexto : parsearFecha(fechaTexto)
      const años = iso ? edad(iso, hoy) : null
      if (!iso) errores.push(`Fecha de nacimiento no válida: «${fechaTexto}» (use dd/mm/aaaa).`)
      else if (iso > hoy || años === null || años > 110) errores.push(`Revise la fecha de nacimiento: «${fechaTexto}».`)
      else fechaNacimiento = iso
    }

    const celulares: { numero: string; principal: boolean }[] = []
    for (const c of separarCelulares(valor(f, 'celulares'))) {
      if (!validarCelular(c)) errores.push(`Celular no válido: «${c}» (10 dígitos, empieza por 3).`)
      else {
        const n = limpiarCelular(c)
        if (!celulares.some((x) => x.numero === n)) celulares.push({ numero: n, principal: celulares.length === 0 })
      }
    }

    const emTexto = valor(f, 'emergenciaCelular')
    let emergenciaCelular = ''
    if (emTexto) {
      if (validarCelular(emTexto)) emergenciaCelular = limpiarCelular(emTexto)
      else errores.push(`Celular de emergencia no válido: «${emTexto}».`)
    }

    const disp = parsearCodigosDisponibilidad(valor(f, 'disponibilidad'))
    if (disp.errores.length) errores.push(`Disponibilidad no válida: ${disp.errores.map((e) => `«${e}»`).join(', ')} (use LU-M, SA-D…).`)

    const datos: NuevoVoluntario = {
      nombre,
      congregacionId,
      invitado,
      invitadoMotivo: invitado ? valor(f, 'motivo') : '',
      invitadoPor: invitado ? valor(f, 'invitadoPor') : '',
      tipo: tipo ?? 'Local',
      fechaNacimiento,
      profesion: valor(f, 'profesion').replace(/\s+/g, ' '),
      celulares,
      emergenciaNombre: valor(f, 'emergenciaNombre').replace(/\s+/g, ' '),
      emergenciaCelular,
      disponibilidad: disp.disponibilidad,
      tareaHabitualId: null,
      observaciones: valor(f, 'observaciones'),
    }

    if (nombre) {
      const dup = duplicadosVoluntario(datos, existentes)
      if (dup.nombre.length) avisos.push(`Ya existe «${dup.nombre[0].nombre}» en la app.`)
      for (const d of dup.celular) avisos.push(`El ${formatoCelular(d.numero)} ya es de «${d.voluntario.nombre}».`)
      // Duplicados dentro del mismo archivo.
      const nn = normalizar(nombre)
      const previo = resultado.find((r) => normalizar(r.datos.nombre) === nn)
      if (previo) avisos.push(`Nombre repetido en el archivo (fila ${previo.fila}).`)
      for (const c of celulares) {
        const otro = resultado.find((r) => r.datos.celulares.some((x) => x.numero === c.numero))
        if (otro) avisos.push(`El ${formatoCelular(c.numero)} se repite en la fila ${otro.fila}.`)
      }
    }

    resultado.push({ fila: k + desplazamiento, datos, congregacionNueva, errores, avisos })
  })
  return { filas: resultado, tieneEncabezado }
}

/** Congregaciones que no existen (sin repetir, con el texto tal como vino la primera vez). */
export function congregacionesFaltantes(filas: FilaImportada[]): string[] {
  const vistas = new Map<string, string>()
  for (const f of filas) {
    if (f.congregacionNueva && !f.errores.length && !vistas.has(normalizar(f.congregacionNueva))) {
      vistas.set(normalizar(f.congregacionNueva), f.congregacionNueva)
    }
  }
  return [...vistas.values()]
}

/**
 * Guarda las filas sin errores. Si `crearCongregaciones`, crea las que faltan; si no,
 * las filas con congregación desconocida se omiten. Devuelve cuántos se crearon.
 */
export async function importarFilas(
  db: BaseVoluntarios,
  filas: FilaImportada[],
  crearCongregaciones: boolean,
): Promise<{ voluntarios: number; congregaciones: number; omitidas: number }> {
  return db.transaction('rw', db.congregaciones, db.voluntarios, async () => {
    const ids = new Map<string, number>()
    let nuevasCong = 0
    if (crearCongregaciones) {
      const existentes = await db.congregaciones.toArray()
      for (const c of existentes) ids.set(normalizar(c.nombre), c.id)
      for (const nombre of congregacionesFaltantes(filas)) {
        const n = normalizar(nombre)
        if (ids.has(n)) continue
        const id = await db.congregaciones.add({
          nombre, numero: '', coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '',
        } as Congregacion)
        ids.set(n, id)
        nuevasCong++
      }
    }
    const ahora = new Date().toISOString()
    const aGuardar: Voluntario[] = []
    let omitidas = 0
    for (const f of filas) {
      if (f.errores.length) {
        omitidas++
        continue
      }
      let congregacionId = f.datos.congregacionId
      if (f.congregacionNueva) {
        const id = ids.get(normalizar(f.congregacionNueva))
        if (id === undefined) {
          omitidas++
          continue
        }
        congregacionId = id
      }
      aGuardar.push({ ...f.datos, congregacionId, nombreNorm: '', profesionNorm: '', creado: ahora, actualizado: ahora } as Voluntario)
    }
    if (aGuardar.length) await db.voluntarios.bulkAdd(aGuardar)
    return { voluntarios: aGuardar.length, congregaciones: nuevasCong, omitidas }
  })
}

// --- Plantilla ---

export const EJEMPLOS_PLANTILLA: string[][] = [
  ['José Pérez Gómez', 'Central', 'Local', '14/05/1980', 'Pintor', 'Marta Pérez', '310 222 3344', '300 111 2233', 'SA-D', '', '', '', ''],
  ['Ana María Ruiz', 'Norte', 'A-2', '02/09/1995', 'Electricista', 'Luis Ruiz', '311 555 6677', '301 444 5566 / 315 000 1122', 'LU-M, MI-T, SA-D', '', '', '', 'Puede traer herramientas'],
  ['Carlos Díaz', '', 'Local', '', 'Plomero', '', '', '320 777 8899', 'SA-M', 'Sí', 'Instalación de tubería', 'Hno. Gómez', ''],
]

export function filasPlantilla(congregaciones: string[]): { datos: string[][]; instrucciones: string[][] } {
  return {
    datos: [[...COLUMNAS], ...EJEMPLOS_PLANTILLA],
    instrucciones: [
      ['Cómo llenar la plantilla'],
      [''],
      ['• Una fila por voluntario. Borre las 3 filas de ejemplo antes de importar.'],
      ['• Nombre: obligatorio, nombre completo.'],
      ['• Congregación: escriba el nombre tal como está en la app. Si no existe, la app ofrece crearla.'],
      ['  Déjela vacía solo para invitados puntuales de otra congregación.'],
      ['• Local/A-2: escriba Local o A-2 (vacío = Local).'],
      ['• Fecha nac.: dd/mm/aaaa, por ejemplo 14/05/1980.'],
      ['• Celulares: 10 dígitos que empiezan por 3. Varios se separan con / o con coma; el primero es el principal.'],
      ['• Disponibilidad: códigos de día + jornada separados por coma: LU MA MI JU VI SA DO y M (mañana), T (tarde), D (día completo).'],
      ['  Ejemplo: LU-M, MI-T, SA-D'],
      ['• Invitado: escriba Sí si es un invitado puntual; entonces puede llenar Motivo e Invitado por.'],
      [''],
      ['Congregaciones en la app:'],
      ...(congregaciones.length ? congregaciones.map((c) => [`  ${c}`]) : [['  (todavía no hay)']]),
    ],
  }
}

/** Resumen corto de una fila para la vista previa. */
export function resumenFila(f: FilaImportada): string {
  return [f.datos.profesion, codigosDisponibilidad(f.datos.disponibilidad)].filter(Boolean).join(' · ')
}
