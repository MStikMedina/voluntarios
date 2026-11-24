import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import {
  analizarFilas, COLUMNAS, congregacionesFaltantes, detectarSeparador, EJEMPLOS_PLANTILLA, importarFilas,
  mapearColumnas, parsearTexto, separarCelulares,
} from './importar'
import { celdaATexto } from './excel'
import type { Voluntario } from '../db/tipos'

const congs = [
  { id: 1, nombre: 'Central', numero: '1234' },
  { id: 2, nombre: 'Norte', numero: '5678' },
]
const HOY = '2026-11-23'

describe('detectar separador y parsear texto', () => {
  it('tabulación (pegado desde Excel)', () => {
    const t = 'Nombre\tCongregación\tDisponibilidad\nJosé\tCentral\tLU-M, SA-D\n'
    expect(detectarSeparador(t)).toBe('\t')
    expect(parsearTexto(t)[1]).toEqual(['José', 'Central', 'LU-M, SA-D'])
  })
  it('punto y coma (CSV de Excel en español)', () => {
    const t = 'Nombre;Congregación;Disponibilidad\r\nJosé;Central;LU-M, SA-D\r\nAna;Norte;SA-T'
    expect(detectarSeparador(t)).toBe(';')
    expect(parsearTexto(t)).toHaveLength(3)
  })
  it('coma con comillas', () => {
    const t = 'Nombre,Congregación,Disponibilidad\nJosé,Central,"LU-M, SA-D"\nAna,Norte,SA-T'
    expect(detectarSeparador(t)).toBe(',')
    expect(parsearTexto(t)[1]).toEqual(['José', 'Central', 'LU-M, SA-D'])
  })
})

describe('encabezados', () => {
  it('reconoce los de la plantilla en cualquier orden', () => {
    const { indices, tieneEncabezado } = mapearColumnas(['Celular(es)', 'Nombre', 'Cel. emergencia', 'Contacto emergencia', 'Congregación'])
    expect(tieneEncabezado).toBe(true)
    expect(indices).toMatchObject({ celulares: 0, nombre: 1, emergenciaCelular: 2, emergenciaNombre: 3, congregacion: 4 })
  })
  it('sin encabezado usa el orden de la plantilla', () => {
    expect(mapearColumnas(['José', 'Central', 'Local']).tieneEncabezado).toBe(false)
  })
  it('todas las columnas de la plantilla', () => {
    const { indices } = mapearColumnas([...COLUMNAS])
    expect(indices).toEqual({
      nombre: 0, congregacion: 1, tipo: 2, fechaNac: 3, profesion: 4, emergenciaNombre: 5, emergenciaCelular: 6,
      celulares: 7, disponibilidad: 8, invitado: 9, motivo: 10, invitadoPor: 11, observaciones: 12,
    })
  })
})

describe('analizar filas', () => {
  it('la plantilla de ejemplo no tiene errores', () => {
    const { filas } = analizarFilas([[...COLUMNAS], ...EJEMPLOS_PLANTILLA], congs, [], HOY)
    expect(filas).toHaveLength(3)
    expect(filas.flatMap((f) => f.errores)).toEqual([])
    expect(filas[1].datos.celulares).toEqual([
      { numero: '3014445566', principal: true },
      { numero: '3150001122', principal: false },
    ])
    expect(filas[1].datos.tipo).toBe('A-2')
    expect(filas[1].datos.disponibilidad).toEqual([null, 'M', null, 'T', null, null, 'D'])
    expect(filas[2].datos.invitado).toBe(true)
    expect(filas[2].datos.congregacionId).toBeNull()
    expect(filas[0].datos.fechaNacimiento).toBe('1980-05-14')
    expect(filas[0].fila).toBe(2)
  })

  it('señala las filas inválidas con su motivo', () => {
    const { filas } = analizarFilas(
      [
        [...COLUMNAS],
        ['', 'Central'],
        ['Pedro', '', 'Local'],
        ['Luis', 'Central', 'Otro', '31/02/1990', '', '', '123', '30012', 'XX-M, LU'],
      ],
      congs, [], HOY,
    )
    expect(filas[0].errores[0]).toMatch(/nombre/)
    expect(filas[1].errores[0]).toMatch(/congregación/)
    const e = filas[2].errores.join(' ')
    expect(e).toMatch(/Local ni A-2/)
    expect(e).toMatch(/Fecha de nacimiento/)
    expect(e).toMatch(/emergencia/)
    expect(e).toMatch(/Celular no válido/)
    expect(e).toMatch(/Disponibilidad/)
  })

  it('congregación por número y congregaciones que faltan', () => {
    const { filas } = analizarFilas([['Ana', '5678'], ['Luis', 'Sur'], ['Eva', 'sur ']], congs, [], HOY)
    expect(filas[0].datos.congregacionId).toBe(2)
    expect(filas[1].congregacionNueva).toBe('Sur')
    expect(congregacionesFaltantes(filas)).toEqual(['Sur'])
  })

  it('avisa duplicados con la app y dentro del archivo', () => {
    const existente = { id: 9, nombre: 'José Pérez', nombreNorm: 'jose perez', celulares: [{ numero: '3001112233', principal: true }] } as Voluntario
    const { filas } = analizarFilas(
      [['JOSE PEREZ', 'Central', '', '', '', '', '', '300 111 2233'], ['Ana', 'Central'], ['ana', 'Norte']],
      congs, [existente], HOY,
    )
    expect(filas[0].avisos.join(' ')).toMatch(/Ya existe «José Pérez»/)
    expect(filas[0].avisos.join(' ')).toMatch(/300 111 2233/)
    expect(filas[2].avisos[0]).toMatch(/repetido en el archivo \(fila 2\)/)
    expect(filas[0].errores).toEqual([])
  })

  it('separa varios celulares', () => {
    expect(separarCelulares('300 111 2233 / 301-444-5566, 3150001122 y 3200000000')).toHaveLength(4)
  })

  it('fechas de Excel', () => {
    expect(celdaATexto(new Date(Date.UTC(1980, 4, 14)))).toBe('1980-05-14')
    expect(celdaATexto(new Date(1980, 4, 14))).toBe('1980-05-14')
  })
})

describe('importar', () => {
  it('importa 20 filas y crea las congregaciones que faltan', async () => {
    const db = new BaseVoluntarios('importar-1')
    await db.congregaciones.add({ nombre: 'Central', numero: '1', coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '' })
    const filas: string[][] = [[...COLUMNAS]]
    for (let i = 0; i < 20; i++) {
      filas.push([`Voluntario ${i + 1}`, i % 2 ? 'Central' : 'Nueva', i % 3 ? 'Local' : 'A-2', '01/01/1990', 'Pintor', '', '', `300000${String(i).padStart(4, '0')}`, 'SA-D'])
    }
    filas.push(['', 'Central']) // inválida
    const a = analizarFilas(filas, await db.congregaciones.toArray(), [], HOY)
    expect(a.filas.filter((f) => f.errores.length)).toHaveLength(1)
    const r = await importarFilas(db, a.filas, true)
    expect(r).toEqual({ voluntarios: 20, congregaciones: 1, omitidas: 1 })
    expect(await db.voluntarios.count()).toBe(20)
    const v = await db.voluntarios.where('nombreNorm').equals('voluntario 1').first()
    const nueva = await db.congregaciones.where('nombre').equals('Nueva').first()
    expect(v?.congregacionId).toBe(nueva?.id)
  })

  it('sin crear congregaciones omite esas filas', async () => {
    const db = new BaseVoluntarios('importar-2')
    const a = analizarFilas([['Ana', 'Sur'], ['Eva', '', '', '', '', '', '', '', '', 'Sí']], [], [], HOY)
    const r = await importarFilas(db, a.filas, false)
    expect(r).toEqual({ voluntarios: 1, congregaciones: 0, omitidas: 1 })
  })
})
