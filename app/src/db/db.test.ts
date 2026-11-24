import 'fake-indexeddb/auto'
import { BaseVoluntarios, PLANTILLAS_INICIALES } from './db'

let n = 0
function nuevaBase() {
  return new BaseVoluntarios(`prueba-${++n}`)
}

const base = {
  congregacionId: 1,
  invitado: false,
  invitadoMotivo: '',
  invitadoPor: '',
  tipo: 'Local' as const,
  fechaNacimiento: '1980-01-01',
  celulares: [{ numero: '3001112233', principal: true }],
  emergenciaNombre: '',
  emergenciaCelular: '',
  disponibilidad: [null, null, null, null, null, null, 'D' as const],
  observaciones: '',
  creado: '',
  actualizado: '',
  nombreNorm: '',
  profesionNorm: '',
}

describe('base de datos', () => {
  it('al crearse tiene el proyecto por defecto y las 4 plantillas', async () => {
    const db = nuevaBase()
    const p = await db.obtenerProyecto()
    expect(p.edadMenor).toBe(18)
    expect(p.jornadas.M).toEqual({ inicio: '07:00', fin: '12:00' })
    expect((await db.plantillas.toArray()).map((x) => x.nombre))
      .toEqual(PLANTILLAS_INICIALES.map((x) => x.nombre))
    await db.ultimaMarca
    await new Promise((r) => setTimeout(r, 20))
    expect((await db.obtenerProyecto()).ultimoCambio).toBeUndefined()
  })

  it('calcula nombreNorm y profesionNorm al crear y al editar', async () => {
    const db = nuevaBase()
    const id = await db.voluntarios.add({ ...base, nombre: 'José  PÉREZ', profesion: 'Pintor' })
    let v = await db.voluntarios.get(id)
    expect(v?.nombreNorm).toBe('jose perez')
    expect(v?.profesionNorm).toBe('pintor')

    await db.voluntarios.update(id, { profesion: 'Electricista Ñoño' })
    v = await db.voluntarios.get(id)
    expect(v?.profesionNorm).toBe('electricista nono')
    expect(v?.nombreNorm).toBe('jose perez')

    expect(await db.voluntarios.where('nombreNorm').startsWith('jose').count()).toBe(1)
  })

  it('marca ultimoCambio en cada escritura, pero no al registrar un respaldo', async () => {
    const db = nuevaBase()
    await db.congregaciones.add({
      nombre: 'Norte', numero: '1', coordinadorNombre: '', coordinadorCelular: '',
      otroContactoNombre: '', otroContactoCelular: '',
    })
    await db.ultimaMarca
    const primero = (await db.obtenerProyecto()).ultimoCambio
    expect(primero).toBeTruthy()

    await db.guardarProyecto({ ultimoRespaldo: '2099-01-01T00:00:00.000Z' })
    expect((await db.obtenerProyecto()).ultimoCambio).toBe(primero)

    await db.guardarProyecto({ nombre: 'Remodelación' })
    const p = await db.obtenerProyecto()
    expect(p.nombre).toBe('Remodelación')
    expect(p.ultimoRespaldo).toBe('2099-01-01T00:00:00.000Z')
    expect(p.ultimoCambio! >= primero!).toBe(true)
  })

  it('los datos siguen ahí al reabrir la base (como al recargar)', async () => {
    const db = nuevaBase()
    await db.voluntarios.add({ ...base, nombre: 'Ana', profesion: '' })
    await db.ultimaMarca
    db.close()
    const otra = new BaseVoluntarios(db.name)
    expect((await otra.voluntarios.toArray()).map((v) => v.nombre)).toEqual(['Ana'])
  })
})
