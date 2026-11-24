import type { Disponibilidad } from '../db/tipos'
import { disponibilidadVacia } from './disponibilidad'
import { filtrarVoluntarios, filtrosActivos, filtrosAParams, filtrosDeParams, filtrosVacios, type FiltrosVoluntarios } from './filtros'

const HOY = '2026-11-23'

function disp(pares: Record<number, 'M' | 'T' | 'D'>): Disponibilidad {
  const d = disponibilidadVacia()
  for (const [k, t] of Object.entries(pares)) d[Number(k)] = t
  return d
}

const vol = (id: number, datos: Partial<Parameters<typeof filtrarVoluntarios>[0][number]>) => ({
  id,
  nombre: '',
  profesion: '',
  congregacionId: 1 as number | null,
  invitado: false,
  tipo: 'Local' as const,
  disponibilidad: disponibilidadVacia(),
  fechaNacimiento: '',
  ...datos,
})

const lista = [
  vol(1, { nombre: 'José Pérez Gómez', profesion: 'Pintor', disponibilidad: disp({ 6: 'D' }), fechaNacimiento: '1980-05-14' }),
  vol(2, { nombre: 'Josefina Ruiz', profesion: 'Electricista', congregacionId: 2, tipo: 'A-2', disponibilidad: disp({ 6: 'M', 1: 'T' }), fechaNacimiento: '2010-01-01' }),
  vol(3, { nombre: 'Andrés Pintó', profesion: 'Carpintero', invitado: true, congregacionId: null, disponibilidad: disp({ 0: 'T' }), fechaNacimiento: '1950-03-03' }),
  vol(4, { nombre: 'María López', profesion: 'pintura y estuco', congregacionId: 2 }),
]

const ids = (f: Partial<FiltrosVoluntarios>) => filtrarVoluntarios(lista, { ...filtrosVacios(), ...f }, HOY).map((v) => v.id)

describe('filtros de voluntarios', () => {
  it('«jose pint» encuentra a José … / Pintor (nombre + profesión, sin tildes)', () => {
    expect(ids({ texto: 'jose pint' })).toEqual([1])
    expect(ids({ texto: 'PINT' })).toEqual([1, 3, 4]) // Pintor, Pintó, pintura
    expect(ids({ texto: '  ' })).toEqual([1, 2, 3, 4])
    expect(ids({ texto: 'jose plomero' })).toEqual([])
  })

  it('congregación, invitados y sin congregación', () => {
    expect(ids({ congregacion: '2' })).toEqual([2, 4])
    expect(ids({ congregacion: 'invitados' })).toEqual([3])
    expect(ids({ congregacion: 'sin' })).toEqual([3])
  })

  it('Local / A-2', () => {
    expect(ids({ tipo: 'A-2' })).toEqual([2])
    expect(ids({ tipo: 'Local' })).toEqual([1, 3, 4])
  })

  it('día y jornada (D cubre M y T; «D» exige día completo)', () => {
    expect(ids({ dia: 6 })).toEqual([1, 2])
    expect(ids({ dia: 6, jornada: 'M' })).toEqual([1, 2])
    expect(ids({ dia: 6, jornada: 'T' })).toEqual([1])
    expect(ids({ dia: 6, jornada: 'D' })).toEqual([1])
    expect(ids({ jornada: 'T' })).toEqual([1, 2, 3]) // cualquier día
    expect(ids({ dia: 3 })).toEqual([])
  })

  it('rango de edad (sin fecha de nacimiento queda fuera)', () => {
    expect(ids({ edadMin: 18 })).toEqual([1, 3])
    expect(ids({ edadMax: 17 })).toEqual([2])
    expect(ids({ edadMin: 18, edadMax: 65 })).toEqual([1])
  })

  it('los filtros se combinan', () => {
    expect(ids({ texto: 'jos', congregacion: '2' })).toEqual([2])
    expect(ids({ texto: 'pint', dia: 6, jornada: 'T', edadMin: 30 })).toEqual([1])
    expect(ids({ congregacion: '2', tipo: 'Local', texto: 'pint' })).toEqual([4])
  })

  it('cuenta los filtros activos y los guarda/lee en la URL', () => {
    const f: FiltrosVoluntarios = { texto: 'josé p', congregacion: 'invitados', tipo: 'A-2', dia: 0, jornada: 'D', edadMin: 18, edadMax: null }
    expect(filtrosActivos(f)).toBe(4)
    expect(filtrosActivos({ ...filtrosVacios(), texto: 'x' })).toBe(0)
    expect(filtrosDeParams(filtrosAParams(f))).toEqual(f)
    expect(filtrosDeParams(new URLSearchParams('d=9&j=X&t=otro&emin=-1'))).toEqual(filtrosVacios())
  })
})
