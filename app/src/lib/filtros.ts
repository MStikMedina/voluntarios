// Búsqueda y filtros de la lista de voluntarios (PLAN.md §2.6).
import type { Turno, Voluntario } from '../db/tipos'
import { edad, hoyISO } from './fechas'
import { normalizar } from './texto'

/** '' = todas; 'invitados' = solo invitados puntuales; 'sin' = sin congregación; '12' = id de congregación. */
export type FiltroCongregacion = string
/** '' = cualquiera; 'M' o 'T' = cubre esa jornada (D también cuenta); 'D' = día completo. */
export type FiltroJornada = '' | Turno

export interface FiltrosVoluntarios {
  texto: string
  congregacion: FiltroCongregacion
  tipo: '' | 'Local' | 'A-2'
  dia: number | null // 0 = domingo … 6 = sábado; null = cualquier día
  jornada: FiltroJornada
  edadMin: number | null
  edadMax: number | null
}

export function filtrosVacios(): FiltrosVoluntarios {
  return { texto: '', congregacion: '', tipo: '', dia: null, jornada: '', edadMin: null, edadMax: null }
}

type VolFiltrable = Pick<
  Voluntario,
  'nombre' | 'profesion' | 'congregacionId' | 'invitado' | 'tipo' | 'disponibilidad' | 'fechaNacimiento'
> & Partial<Pick<Voluntario, 'nombreNorm' | 'profesionNorm'>>

/** ¿El turno del día sirve para el filtro de jornada? */
function turnoSirve(turno: Turno | null | undefined, jornada: FiltroJornada): boolean {
  if (!turno) return false
  if (!jornada) return true
  if (jornada === 'D') return turno === 'D'
  return turno === 'D' || turno === jornada
}

/** Todos los filtros se combinan con «y». La búsqueda mira nombre y profesión, por cada palabra. */
export function cumpleFiltros(v: VolFiltrable, f: FiltrosVoluntarios, hoy: string = hoyISO()): boolean {
  const palabras = normalizar(f.texto).split(' ').filter(Boolean)
  if (palabras.length) {
    const texto = `${v.nombreNorm || normalizar(v.nombre)} ${v.profesionNorm || normalizar(v.profesion)}`
    if (!palabras.every((p) => texto.includes(p))) return false
  }

  if (f.congregacion === 'invitados') {
    if (!v.invitado) return false
  } else if (f.congregacion === 'sin') {
    if (v.congregacionId != null) return false
  } else if (f.congregacion) {
    if (String(v.congregacionId) !== f.congregacion) return false
  }

  if (f.tipo && v.tipo !== f.tipo) return false

  if (f.dia !== null || f.jornada) {
    const dias = f.dia !== null ? [f.dia] : [0, 1, 2, 3, 4, 5, 6]
    if (!dias.some((d) => turnoSirve(v.disponibilidad?.[d], f.jornada))) return false
  }

  if (f.edadMin !== null || f.edadMax !== null) {
    const e = edad(v.fechaNacimiento, hoy)
    if (e === null) return false // sin fecha de nacimiento no se puede saber
    if (f.edadMin !== null && e < f.edadMin) return false
    if (f.edadMax !== null && e > f.edadMax) return false
  }
  return true
}

export function filtrarVoluntarios<T extends VolFiltrable>(lista: T[], f: FiltrosVoluntarios, hoy?: string): T[] {
  return lista.filter((v) => cumpleFiltros(v, f, hoy))
}

/** Cuántos filtros (sin contar la búsqueda) están puestos. Día + jornada cuentan como uno. */
export function filtrosActivos(f: FiltrosVoluntarios): number {
  return (
    (f.congregacion ? 1 : 0) +
    (f.tipo ? 1 : 0) +
    (f.dia !== null || f.jornada ? 1 : 0) +
    (f.edadMin !== null || f.edadMax !== null ? 1 : 0)
  )
}

// --- Guardado en la URL (?q=…&c=…), para que se conserven al ir a la ficha y volver ---

const entero = (t: string | null, min: number, max: number): number | null => {
  if (t === null || !/^\d+$/.test(t)) return null
  const n = Number(t)
  return n >= min && n <= max ? n : null
}

export function filtrosDeParams(p: URLSearchParams): FiltrosVoluntarios {
  const tipo = p.get('t')
  const jornada = p.get('j')
  return {
    texto: p.get('q') ?? '',
    congregacion: p.get('c') ?? '',
    tipo: tipo === 'Local' || tipo === 'A-2' ? tipo : '',
    dia: entero(p.get('d'), 0, 6),
    jornada: jornada === 'M' || jornada === 'T' || jornada === 'D' ? jornada : '',
    edadMin: entero(p.get('emin'), 0, 130),
    edadMax: entero(p.get('emax'), 0, 130),
  }
}

export function filtrosAParams(f: FiltrosVoluntarios): URLSearchParams {
  const p = new URLSearchParams()
  if (f.texto) p.set('q', f.texto)
  if (f.congregacion) p.set('c', f.congregacion)
  if (f.tipo) p.set('t', f.tipo)
  if (f.dia !== null) p.set('d', String(f.dia))
  if (f.jornada) p.set('j', f.jornada)
  if (f.edadMin !== null) p.set('emin', String(f.edadMin))
  if (f.edadMax !== null) p.set('emax', String(f.edadMax))
  return p
}

// Última búsqueda de la lista (en memoria), para que «← Voluntarios» desde la ficha la conserve.
let ultimaBusqueda = ''
export function recordarBusquedaLista(search: string) {
  ultimaBusqueda = search
}
export function rutaListaVoluntarios(): string {
  return ultimaBusqueda ? `/voluntarios?${ultimaBusqueda}` : '/voluntarios'
}
