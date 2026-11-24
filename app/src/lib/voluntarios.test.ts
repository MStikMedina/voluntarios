import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import type { Voluntario } from '../db/tipos'
import {
  asegurarPrincipal, celularPrincipal, duplicadosVoluntario, eliminarVoluntario, formAVoluntario,
  formVoluntarioVacio, guardarVoluntario, hayErrores, ordenarVoluntarios, validarVoluntario, voluntarioAForm,
} from './voluntarios'

const base = () => ({ ...formVoluntarioVacio(), nombre: 'José Pérez', congregacionId: '1' })

describe('voluntarios: validación', () => {
  it('exige nombre y congregación (salvo invitado)', () => {
    const e = validarVoluntario(formVoluntarioVacio())
    expect(e.nombre).toBeTruthy()
    expect(e.congregacionId).toBeTruthy()
    expect(validarVoluntario({ ...formVoluntarioVacio(), nombre: 'Ana', invitado: true }).congregacionId).toBeUndefined()
    expect(hayErrores(validarVoluntario(base()))).toBe(false)
  })

  it('valida cada celular (10 dígitos, empieza por 3) y avisa repetidos dentro del formulario', () => {
    const f = { ...base(), celulares: [
      { numero: '300 123 4567', principal: true },
      { numero: '12345', principal: false },
      { numero: '', principal: false },
      { numero: '+57 3001234567', principal: false },
    ] }
    const e = validarVoluntario(f)
    expect(e.celular?.[0]).toBeUndefined()
    expect(e.celular?.[1]).toBeTruthy()
    expect(e.celular?.[2]).toBeUndefined()
    expect(e.celular?.[3]).toMatch(/arriba/)
    expect(validarVoluntario({ ...base(), emergenciaCelular: '2001234567' }).emergenciaCelular).toBeTruthy()
  })

  it('valida la fecha de nacimiento', () => {
    const hoy = '2026-11-23'
    expect(validarVoluntario({ ...base(), fechaNacimiento: '2027-01-01' }, hoy).fechaNacimiento).toBeTruthy()
    expect(validarVoluntario({ ...base(), fechaNacimiento: '1900-01-01' }, hoy).fechaNacimiento).toBeTruthy()
    expect(validarVoluntario({ ...base(), fechaNacimiento: '1980-05-14' }, hoy).fechaNacimiento).toBeUndefined()
  })
})

describe('voluntarios: formulario ↔ datos', () => {
  it('limpia lo que se guarda: textos, celulares, filas vacías y un solo principal', () => {
    const d = formAVoluntario({
      ...base(),
      nombre: '  José   Pérez ',
      celulares: [
        { numero: '', principal: true },
        { numero: '310-444-5566', principal: false },
        { numero: '+57 300 123 4567', principal: false },
      ],
      emergenciaCelular: '320 777 8899',
      invitadoMotivo: 'se borra porque no es invitado',
    })
    expect(d.nombre).toBe('José Pérez')
    expect(d.congregacionId).toBe(1)
    expect(d.celulares).toEqual([
      { numero: '3104445566', principal: true },
      { numero: '3001234567', principal: false },
    ])
    expect(d.emergenciaCelular).toBe('3207778899')
    expect(d.invitadoMotivo).toBe('')
    expect(voluntarioAForm(d).celulares[0].numero).toBe('310 444 5566')
  })

  it('asegura exactamente un principal', () => {
    expect(asegurarPrincipal([{ principal: false }, { principal: false }]).map((c) => c.principal)).toEqual([true, false])
    expect(asegurarPrincipal([{ principal: true }, { principal: true }]).map((c) => c.principal)).toEqual([true, false])
    expect(celularPrincipal({ celulares: [{ numero: '1', principal: false }, { numero: '2', principal: true }] })).toBe('2')
  })
})

const vol = (id: number, nombre: string, ...numeros: string[]): Voluntario => ({
  ...formAVoluntario({ ...base(), nombre }),
  celulares: numeros.map((numero, i) => ({ numero, principal: i === 0 })),
  id, nombreNorm: '', profesionNorm: '', creado: '', actualizado: '',
})

describe('voluntarios: duplicados y orden', () => {
  it('avisa por nombre (sin tildes) y por cualquier celular, sin contarse a sí mismo', () => {
    const todos = [vol(1, 'José Pérez', '3001234567'), vol(2, 'Ana', '3104445566', '3207778899')]
    const d = duplicadosVoluntario({ nombre: 'jose  perez', celulares: [{ numero: '3207778899', principal: true }] }, todos)
    expect(d.nombre.map((v) => v.id)).toEqual([1])
    expect(d.celular.map((c) => c.voluntario.id)).toEqual([2])
    const propio = duplicadosVoluntario({ nombre: 'José Pérez', celulares: [{ numero: '3001234567', principal: true }] }, todos, 1)
    expect(propio.nombre).toEqual([])
    expect(propio.celular).toEqual([])
  })

  it('ordena alfabéticamente sin importar tildes', () => {
    expect(ordenarVoluntarios([vol(1, 'Óscar'), vol(2, 'ana'), vol(3, 'Ángel')]).map((v) => v.id)).toEqual([2, 3, 1])
  })
})

describe('voluntarios: guardar y eliminar', () => {
  let db: BaseVoluntarios
  beforeEach(async () => {
    db = new BaseVoluntarios(`prueba-vol-${Math.random()}`)
    await db.open()
  })
  afterEach(async () => {
    await db.ultimaMarca
    await db.delete()
  })

  it('crea, edita (conserva creado) y elimina con su programación y asistencia', async () => {
    const id = await guardarVoluntario(db, formAVoluntario({ ...base(), profesion: 'Pintor' }))
    const creado = await db.voluntarios.get(id)
    expect(creado?.nombreNorm).toBe('jose perez')
    expect(creado?.profesionNorm).toBe('pintor')

    await guardarVoluntario(db, formAVoluntario({ ...voluntarioAForm(creado!), nombre: 'José Pérez Gómez' }), id)
    const editado = await db.voluntarios.get(id)
    expect(editado?.nombre).toBe('José Pérez Gómez')
    expect(editado?.creado).toBe(creado?.creado)
    expect(await db.voluntarios.count()).toBe(1)

    await db.programaciones.add({ fecha: '2026-11-28', jornada: 'M', voluntarioId: id, confirmacion: 'pendiente', mensajeEnviado: false } as never)
    await db.asistencias.add({ fecha: '2026-11-28', jornada: 'M', voluntarioId: id, asistio: true, observacion: '' } as never)
    await eliminarVoluntario(db, id)
    expect(await db.voluntarios.get(id)).toBeUndefined()
    expect(await db.programaciones.count()).toBe(0)
    expect(await db.asistencias.count()).toBe(0)
  })

  it('no edita un voluntario que no existe', async () => {
    await expect(guardarVoluntario(db, formAVoluntario(base()), 999)).rejects.toThrow()
  })
})
