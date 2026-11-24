import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import { guardarVoluntario } from './voluntarios'
import {
  borrarDatos, contarBase, crearRespaldo, leerRespaldo, nombreArchivoRespaldo, respaldoPendiente, restaurarRespaldo,
  RespaldoInvalido,
} from './respaldo'
import type { NuevoVoluntario } from '../db/tipos'

let n = 0
const nuevaBase = () => new BaseVoluntarios(`respaldo-${++n}`)

const vol = (nombre: string, congregacionId: number): NuevoVoluntario => ({
  nombre,
  congregacionId,
  invitado: false,
  invitadoMotivo: '',
  invitadoPor: '',
  tipo: 'Local',
  fechaNacimiento: '1990-03-04',
  profesion: 'Pintor',
  celulares: [{ numero: '3001112233', principal: true }],
  emergenciaNombre: 'Ana',
  emergenciaCelular: '3109998877',
  disponibilidad: [null, null, null, null, null, null, 'D'],
  tareaHabitualId: null,
  observaciones: '',
})

async function llenar(db: BaseVoluntarios) {
  const c = await db.congregaciones.add({
    nombre: 'Norte', numero: '123', coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '',
  })
  await guardarVoluntario(db, vol('José Pérez', c))
  await guardarVoluntario(db, vol('Ana Ruiz', c))
  await db.dias.put({ fecha: '2026-12-05', cupoM: 10, cupoT: 8, cuposTarea: {}, notas: '' })
  await db.guardarProyecto({ nombre: 'Remodelación', ciudad: 'Bogotá' })
}

describe('respaldo', () => {
  it('respaldo → JSON → restaurar (reemplazar) deja los datos idénticos', async () => {
    const a = nuevaBase()
    await llenar(a)
    const r = await crearRespaldo(a)
    const texto = JSON.stringify(r)

    const b = nuevaBase()
    await b.congregaciones.add({
      nombre: 'Sobra', numero: '', coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '',
    })
    await restaurarRespaldo(b, leerRespaldo(texto), 'reemplazar')

    expect(await contarBase(b)).toEqual(await contarBase(a))
    expect(await b.voluntarios.toArray()).toEqual(await a.voluntarios.toArray())
    expect(await b.congregaciones.toArray()).toEqual(await a.congregaciones.toArray())
    expect(await b.dias.toArray()).toEqual(await a.dias.toArray())
    const p = await b.obtenerProyecto()
    expect(p.nombre).toBe('Remodelación')
    // Tras reemplazar no queda respaldo pendiente.
    expect(respaldoPendiente(p)).toBe(false)
  })

  it('combinar agrega y actualiza por id sin borrar lo demás', async () => {
    const a = nuevaBase()
    await llenar(a)
    const r = await crearRespaldo(a)

    // B parte de los mismos datos (mismos ids), cambia uno y agrega otro.
    const b = nuevaBase()
    await restaurarRespaldo(b, r, 'reemplazar')
    const jose = (await b.voluntarios.where('nombreNorm').equals('jose perez').first())!
    await b.voluntarios.update(jose.id, { nombre: 'Cambiado' })
    const soloB = await guardarVoluntario(b, vol('Solo en B', jose.congregacionId!))
    await restaurarRespaldo(b, r, 'combinar')

    expect(await b.voluntarios.count()).toBe(3)
    expect((await b.voluntarios.get(jose.id))?.nombre).toBe('José Pérez')
    expect((await b.voluntarios.get(soloB))?.nombre).toBe('Solo en B')
  })

  it('rechaza archivos que no son respaldos', () => {
    expect(() => leerRespaldo('hola')).toThrow(RespaldoInvalido)
    expect(() => leerRespaldo('{"app":"otra","datos":{}}')).toThrow(/no es un respaldo/)
    expect(() => leerRespaldo('{"app":"voluntarios","version":99,"datos":{}}')).toThrow(/más nueva/)
    expect(() => leerRespaldo('{"app":"voluntarios","version":1,"datos":{"voluntarios":[{"nombre":"x"}]}}')).toThrow(/dañado/)
    // Tablas que faltan se toman como vacías.
    expect(leerRespaldo('{"app":"voluntarios","version":1,"datos":{}}').datos.tareas).toEqual([])
  })

  it('nombre del archivo', () => {
    expect(nombreArchivoRespaldo('2026-11-23')).toBe('voluntarios-respaldo-2026-11-23.json')
  })

  it('recordatorio según cambios y frecuencia', () => {
    const ahora = new Date(2026, 10, 23, 10, 0)
    const ayer = new Date(2026, 10, 22, 9, 0).toISOString()
    const hoyTemprano = new Date(2026, 10, 23, 8, 0).toISOString()
    const hoyMas = new Date(2026, 10, 23, 9, 0).toISOString()
    expect(respaldoPendiente({ frecuenciaRespaldo: 'diario' }, ahora)).toBe(false) // sin cambios
    expect(respaldoPendiente({ frecuenciaRespaldo: 'diario', ultimoCambio: hoyMas }, ahora)).toBe(true) // nunca respaldó
    expect(respaldoPendiente({ frecuenciaRespaldo: 'diario', ultimoCambio: hoyMas, ultimoRespaldo: ayer }, ahora)).toBe(true)
    expect(respaldoPendiente({ frecuenciaRespaldo: 'diario', ultimoCambio: hoyMas, ultimoRespaldo: hoyTemprano }, ahora)).toBe(false)
    expect(respaldoPendiente({ frecuenciaRespaldo: 'diario', ultimoCambio: hoyTemprano, ultimoRespaldo: hoyMas }, ahora)).toBe(false)
    expect(respaldoPendiente({ frecuenciaRespaldo: 'semanal', ultimoCambio: hoyMas, ultimoRespaldo: ayer }, ahora)).toBe(false)
    const hace8 = new Date(2026, 10, 15, 9, 0).toISOString()
    expect(respaldoPendiente({ frecuenciaRespaldo: 'semanal', ultimoCambio: hoyMas, ultimoRespaldo: hace8 }, ahora)).toBe(true)
  })
})

describe('empezar de cero', () => {
  it('borra los datos y conserva Ajustes y plantillas', async () => {
    const db = nuevaBase()
    await llenar(db)
    await db.plantillas.update(1, { texto: 'mía' })
    await borrarDatos(db)
    const c = await contarBase(db)
    expect({ ...c, plantillas: 0 }).toEqual({ congregaciones: 0, voluntarios: 0, tareas: 0, dias: 0, programaciones: 0, asistencias: 0, plantillas: 0 })
    expect(c.plantillas).toBe(4)
    expect((await db.plantillas.get(1))?.texto).toBe('mía')
    expect((await db.obtenerProyecto()).nombre).toBe('Remodelación')
  })

  it('con «todo» también reinicia Ajustes y plantillas', async () => {
    const db = nuevaBase()
    await llenar(db)
    await db.plantillas.update(1, { texto: 'mía' })
    await borrarDatos(db, true)
    expect((await db.obtenerProyecto()).nombre).toBe('')
    const pl = await db.plantillas.toArray()
    expect(pl).toHaveLength(4)
    expect(pl.some((p) => p.texto === 'mía')).toBe(false)
  })
})
