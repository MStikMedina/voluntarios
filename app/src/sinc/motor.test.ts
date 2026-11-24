import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import type { Congregacion } from '../db/tipos'
import { borrarDatos, crearRespaldo, restaurarRespaldo } from '../lib/respaldo'
import { Sincronizador, TABLAS_DATOS, type FilaRemota, type Remoto } from './motor'

/** Nube en memoria con el mismo comportamiento que la tabla `registros`. */
class NubeFalsa implements Remoto {
  filas = new Map<string, FilaRemota>()
  private reloj = 0
  async subir(filas: FilaRemota[]) {
    for (const f of filas) {
      const t = new Date(Date.UTC(2026, 0, 1) + ++this.reloj).toISOString()
      this.filas.set(`${f.tabla}|${f.id}`, { ...structuredClone(f), actualizado_en: t })
    }
  }
  async bajar(desde: string | null, limite: number) {
    return [...this.filas.values()]
      .filter((f) => !desde || f.actualizado_en! > desde)
      .sort((a, b) => a.actualizado_en!.localeCompare(b.actualizado_en!))
      .slice(0, limite)
      .map((f) => structuredClone(f))
  }
  async hayDatos() {
    return [...this.filas.values()].some((f) => !f.borrado && (TABLAS_DATOS as readonly string[]).includes(f.tabla))
  }
  escuchar() {
    return () => {}
  }
  vivas(tabla: string) {
    return [...this.filas.values()].filter((f) => f.tabla === tabla && !f.borrado)
  }
}

let n = 0
function dispositivo(nube: NubeFalsa) {
  const db = new BaseVoluntarios(`sinc-${++n}`)
  const s = new Sincronizador(db)
  s.iniciar(nube)
  return { db, s }
}

const congregacion = (nombre: string): Omit<Congregacion, 'id'> => ({
  nombre, numero: '', coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '',
})

describe('sincronización', () => {
  it('anota los cambios locales como pendientes y los sube', async () => {
    const nube = new NubeFalsa()
    const { db, s } = dispositivo(nube)
    await s.sincronizar()
    const id = await db.congregaciones.add(congregacion('Norte') as Congregacion)
    expect(await db.pendientes.count()).toBeGreaterThan(0)
    await s.sincronizar()
    expect(await db.pendientes.count()).toBe(0)
    expect(nube.vivas('congregaciones').map((f) => f.datos?.nombre)).toEqual(['Norte'])
    expect(nube.vivas('congregaciones')[0].id).toBe(String(id))
    s.detener()
  })

  it('los ids nuevos son grandes y únicos (no 1, 2, 3…)', async () => {
    const nube = new NubeFalsa()
    const { db, s } = dispositivo(nube)
    const ids = await db.congregaciones.bulkAdd(
      [congregacion('A'), congregacion('B'), congregacion('C')] as Congregacion[], { allKeys: true },
    )
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(id).toBeGreaterThan(1_000_000)
    s.detener()
  })

  it('lo que crea un dispositivo le llega al otro, incluidos los borrados', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    const b = dispositivo(nube)
    await a.s.sincronizar()
    await b.s.sincronizar()

    const id = await a.db.congregaciones.add(congregacion('Central') as Congregacion)
    await a.db.guardarProyecto({ nombre: 'Salón Norte' })
    await a.s.sincronizar()
    await b.s.sincronizar()
    expect((await b.db.congregaciones.get(id))?.nombre).toBe('Central')
    expect((await b.db.obtenerProyecto()).nombre).toBe('Salón Norte')
    // Lo que llegó de la nube no queda pendiente en B.
    expect(await b.db.pendientes.count()).toBe(0)

    await b.db.congregaciones.delete(id)
    await b.s.sincronizar()
    await a.s.sincronizar()
    expect(await a.db.congregaciones.get(id)).toBeUndefined()
    a.s.detener()
    b.s.detener()
  })

  it('las marcas de respaldo del proyecto son de cada dispositivo', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.guardarProyecto({ ultimoRespaldo: '2026-11-01T00:00:00.000Z' })
    expect(await a.db.pendientes.count()).toBe(0)
    await a.db.guardarProyecto({ ciudad: 'Bucaramanga' })
    await a.s.sincronizar()
    const p = nube.vivas('proyecto')[0].datos!
    expect(p.ciudad).toBe('Bucaramanga')
    expect(p.ultimoRespaldo).toBeUndefined()
    expect(p.ultimoCambio).toBeUndefined()
    a.s.detener()
  })

  it('un cambio local sin subir no se pisa con lo que llega de la nube', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    const b = dispositivo(nube)
    await a.s.sincronizar()
    const id = await a.db.congregaciones.add(congregacion('Original') as Congregacion)
    await a.s.sincronizar()
    await b.s.sincronizar()

    await a.db.congregaciones.update(id, { nombre: 'De A' })
    await a.s.sincronizar()
    await b.db.congregaciones.update(id, { nombre: 'De B' }) // B cambia sin haber bajado lo de A
    await b.s.sincronizar()
    await a.s.sincronizar()
    expect((await b.db.congregaciones.get(id))?.nombre).toBe('De B')
    expect((await a.db.congregaciones.get(id))?.nombre).toBe('De B')
    a.s.detener()
    b.s.detener()
  })

  it('primera vez: un dispositivo nuevo (sin datos) baja todo de la nube', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('Norte') as Congregacion)
    await a.db.guardarProyecto({ nombre: 'Remodelación' })
    await a.s.sincronizar()

    const b = dispositivo(nube)
    await b.s.sincronizar()
    expect(b.s.obtenerInfo().estado).toBe('al_dia')
    expect((await b.db.congregaciones.toArray()).map((c) => c.nombre)).toEqual(['Norte'])
    expect((await b.db.obtenerProyecto()).nombre).toBe('Remodelación')
    expect(await b.db.plantillas.count()).toBe(4)
    a.s.detener()
    b.s.detener()
  })

  it('primera vez: si la nube está vacía, se suben los datos que ya había en el dispositivo', async () => {
    const nube = new NubeFalsa()
    // Datos creados antes de conectar la nube.
    const db = new BaseVoluntarios(`sinc-${++n}`)
    await db.congregaciones.add(congregacion('Ya existía') as Congregacion)
    await db.pendientes.clear() // como si fueran de la versión anterior de la app
    const s = new Sincronizador(db)
    s.iniciar(nube)
    await s.sincronizar()
    expect(nube.vivas('congregaciones').map((f) => f.datos?.nombre)).toEqual(['Ya existía'])
    expect(nube.vivas('plantillas')).toHaveLength(4)
    expect(nube.vivas('proyecto')).toHaveLength(1)
    s.detener()
  })

  it('primera vez con datos distintos en ambos lados: pregunta, y se puede usar la nube', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('En la nube') as Congregacion)
    await a.s.sincronizar()

    const db = new BaseVoluntarios(`sinc-${++n}`)
    await db.congregaciones.add(congregacion('Solo aquí') as Congregacion)
    const s = new Sincronizador(db)
    s.iniciar(nube)
    await s.sincronizar()
    expect(s.obtenerInfo().estado).toBe('decidir')
    expect(s.obtenerInfo().comparacion?.nube.congregaciones).toBe(1)
    expect(nube.vivas('congregaciones')).toHaveLength(1) // no subió nada

    await s.usarNube()
    expect((await db.congregaciones.toArray()).map((c) => c.nombre)).toEqual(['En la nube'])
    expect(s.obtenerInfo().estado).toBe('al_dia')
    a.s.detener()
    s.detener()
  })

  it('…o se puede reemplazar la nube con lo de este dispositivo', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('En la nube') as Congregacion)
    await a.s.sincronizar()

    const db = new BaseVoluntarios(`sinc-${++n}`)
    await db.congregaciones.add(congregacion('Solo aquí') as Congregacion)
    const s = new Sincronizador(db)
    s.iniciar(nube)
    await s.sincronizar()
    await s.subirEsteDispositivo()
    expect(nube.vivas('congregaciones').map((f) => f.datos?.nombre)).toEqual(['Solo aquí'])

    await a.s.sincronizar()
    expect((await a.db.congregaciones.toArray()).map((c) => c.nombre)).toEqual(['Solo aquí'])
    a.s.detener()
    s.detener()
  })

  it('primera vez con los mismos datos que la nube: no pregunta', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('Norte') as Congregacion)
    await a.s.sincronizar()
    const r = await crearRespaldo(a.db)

    const db = new BaseVoluntarios(`sinc-${++n}`)
    await restaurarRespaldo(db, r, 'reemplazar')
    const s = new Sincronizador(db)
    s.iniciar(nube)
    await s.sincronizar()
    expect(s.obtenerInfo().estado).toBe('al_dia')
    a.s.detener()
    s.detener()
  })

  it('restaurar un respaldo (reemplazar) deja la nube igual al archivo', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('Vieja') as Congregacion)
    await a.s.sincronizar()

    const origen = new BaseVoluntarios(`sinc-${++n}`)
    await origen.congregaciones.add(congregacion('Del archivo') as Congregacion)
    await restaurarRespaldo(a.db, await crearRespaldo(origen), 'reemplazar')
    await a.s.sincronizar()
    expect(nube.vivas('congregaciones').map((f) => f.datos?.nombre)).toEqual(['Del archivo'])
    a.s.detener()
  })

  it('empezar de cero también borra en la nube', async () => {
    const nube = new NubeFalsa()
    const a = dispositivo(nube)
    await a.s.sincronizar()
    await a.db.congregaciones.add(congregacion('Norte') as Congregacion)
    await a.s.sincronizar()
    await borrarDatos(a.db)
    await a.s.sincronizar()
    expect(nube.vivas('congregaciones')).toHaveLength(0)
    expect(nube.vivas('plantillas')).toHaveLength(4)
    a.s.detener()
  })
})
