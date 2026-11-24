// Sincronización con la nube (Supabase).
//
// La app sigue trabajando sobre su base local (funciona sin internet). Cada cambio local queda
// anotado en `pendientes` (lo hace el middleware de db.ts). Este motor:
//   1. sube los pendientes (el valor actual del registro, o "borrado" si ya no existe),
//   2. baja lo que otros dispositivos cambiaron desde la última vez.
// Si un registro tiene cambios locales sin subir, lo que llega de la nube no lo pisa: se sube el
// local y ese queda (gana el último que sube).
import {
  CAMPOS_LOCALES_PROYECTO, jsonEstable, marcarRemota, sinCamposLocales, TABLAS_SINC,
  type BaseVoluntarios, type Pendiente, type TablaSinc,
} from '../db/db'
import type { Proyecto } from '../db/tipos'

/** Un registro tal como se guarda en la nube (tabla `registros`). */
export interface FilaRemota {
  tabla: TablaSinc
  id: string
  datos: Record<string, unknown> | null
  borrado: boolean
  actualizado_en?: string
}

/** Lo que el motor necesita de la nube (en pruebas se usa una versión en memoria). */
export interface Remoto {
  subir(filas: FilaRemota[]): Promise<void>
  /** Filas cambiadas después de `desde` (todas si es null), en orden de cambio. */
  bajar(desde: string | null, limite: number): Promise<FilaRemota[]>
  /** ¿Hay datos reales (no solo ajustes y plantillas) en la nube? */
  hayDatos(): Promise<boolean>
  /** Avisa cuando otro dispositivo guarda algo. Devuelve la función para dejar de escuchar. */
  escuchar(alCambiar: () => void): () => void
}

export type EstadoNube =
  | 'apagada' // sin configurar
  | 'sincronizando'
  | 'al_dia'
  | 'sin_conexion'
  | 'error'
  | 'decidir' // este dispositivo y la nube tienen datos distintos: el usuario elige

export interface InfoNube {
  estado: EstadoNube
  ultima: string | null // ISO de la última sincronización completa
  error: string | null
  /** Solo en 'decidir': cuántos registros hay en cada lado. */
  comparacion: { local: Record<string, number>; nube: Record<string, number> } | null
}

/** Tablas con datos "reales" (las que hacen que valga la pena preguntar antes de reemplazar). */
export const TABLAS_DATOS = ['congregaciones', 'voluntarios', 'tareas', 'dias', 'programaciones', 'asistencias'] as const

const LOTE_SUBIDA = 500
const LOTE_BAJADA = 1000
// Al bajar se repasan también los últimos segundos ya vistos: cubre cambios que el servidor
// confirmó un poco tarde. Repetir filas no hace daño.
const MARGEN_MS = 60_000

const sinInternet = () => globalThis.navigator?.onLine === false

const claveDe = (tabla: TablaSinc, id: string): number | string => (tabla === 'dias' ? id : Number(id))
const llave = (tabla: string, clave: unknown) => `${tabla}|${String(clave)}`

export class Sincronizador {
  private remoto: Remoto | null = null
  private info: InfoNube = { estado: 'apagada', ultima: null, error: null, comparacion: null }
  private oyentes = new Set<() => void>()
  private enCurso: Promise<void> | null = null
  private repetir = false
  private temporizador: ReturnType<typeof setTimeout> | null = null
  private limpiezas: (() => void)[] = []
  private db: BaseVoluntarios

  constructor(db: BaseVoluntarios) {
    this.db = db
  }

  // ---------- estado para la interfaz ----------

  obtenerInfo = (): InfoNube => this.info

  suscribir = (fn: () => void): (() => void) => {
    this.oyentes.add(fn)
    return () => this.oyentes.delete(fn)
  }

  private cambiar(parcial: Partial<InfoNube>) {
    this.info = { ...this.info, ...parcial }
    for (const fn of this.oyentes) fn()
  }

  // ---------- arranque ----------

  /** Conecta con la nube y deja la sincronización automática funcionando. */
  iniciar(remoto: Remoto) {
    this.detener()
    this.remoto = remoto
    this.cambiar({ estado: 'sincronizando', error: null })
    this.db.alHaberPendientes = () => this.programar(1500)
    this.limpiezas.push(() => (this.db.alHaberPendientes = null))
    this.limpiezas.push(remoto.escuchar(() => this.programar(500)))

    const w = globalThis.window
    if (w?.addEventListener) {
      const enLinea = () => void this.sincronizar()
      const fueraDeLinea = () => this.cambiar({ estado: 'sin_conexion' })
      const visible = () => {
        if (document.visibilityState === 'visible') void this.sincronizar()
      }
      w.addEventListener('online', enLinea)
      w.addEventListener('offline', fueraDeLinea)
      document.addEventListener('visibilitychange', visible)
      // Respaldo por si se pierde el aviso en tiempo real.
      const intervalo = setInterval(() => {
        if (document.visibilityState === 'visible') void this.sincronizar()
      }, 60_000)
      this.limpiezas.push(() => {
        w.removeEventListener('online', enLinea)
        w.removeEventListener('offline', fueraDeLinea)
        document.removeEventListener('visibilitychange', visible)
        clearInterval(intervalo)
      })
    }
    void this.sincronizar()
  }

  detener() {
    for (const f of this.limpiezas) f()
    this.limpiezas = []
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = null
    this.remoto = null
  }

  private programar(ms: number) {
    if (!this.remoto) return
    if (this.temporizador) clearTimeout(this.temporizador)
    this.temporizador = setTimeout(() => {
      this.temporizador = null
      void this.sincronizar()
    }, ms)
  }

  // ---------- ciclo ----------

  /** Sube y baja cambios. Si ya hay una sincronización en curso, se repite al terminar. */
  sincronizar(): Promise<void> {
    if (!this.remoto) return Promise.resolve()
    if (this.enCurso) {
      this.repetir = true
      return this.enCurso
    }
    this.enCurso = (async () => {
      do {
        this.repetir = false
        await this.ciclo()
      } while ((this.repetir as boolean) && this.remoto)
    })().finally(() => {
      this.enCurso = null
    })
    return this.enCurso
  }

  private async ciclo() {
    const remoto = this.remoto
    if (!remoto) return
    if (this.info.estado === 'decidir') return
    if (sinInternet()) {
      this.cambiar({ estado: 'sin_conexion' })
      return
    }
    this.cambiar({ estado: 'sincronizando' })
    try {
      if (!(await this.leerMeta('inicializado'))) {
        const listo = await this.inicializar(remoto)
        if (!listo) return
      }
      await this.subir(remoto)
      await this.bajar(remoto)
      this.cambiar({ estado: 'al_dia', ultima: new Date().toISOString(), error: null })
    } catch (e) {
      const sinRed = sinInternet() || e instanceof TypeError
      this.cambiar({ estado: sinRed ? 'sin_conexion' : 'error', error: (e as Error).message })
      this.programar(30_000) // reintentar
    }
  }

  // ---------- primera vez en este dispositivo ----------

  /**
   * - Nube vacía: se sube todo lo de este dispositivo.
   * - Nube con datos y este dispositivo sin datos (o con un subconjunto idéntico): se usan los de la nube.
   * - Ambos con datos distintos: se pregunta al usuario (estado 'decidir').
   */
  private async inicializar(remoto: Remoto): Promise<boolean> {
    if (!(await remoto.hayDatos())) {
      await this.anotarTodoLocal()
      await this.guardarMeta('inicializado', true)
      return true
    }
    const nube = await this.bajarTodo(remoto)
    if (!(await this.hayDatosLocales()) || (await this.localIncluidoEn(nube))) {
      await this.aplicar(nube, true)
      await this.guardarMeta('inicializado', true)
      return true
    }
    this.cambiar({ estado: 'decidir', comparacion: { local: await this.contarLocal(), nube: contarFilas(nube) } })
    return false
  }

  /** Decisión del usuario: quedarse con lo de la nube (se descarta lo de este dispositivo). */
  async usarNube() {
    const remoto = this.remoto
    if (!remoto) return
    this.cambiar({ estado: 'sincronizando', comparacion: null })
    try {
      await this.aplicar(await this.bajarTodo(remoto), true)
      await this.guardarMeta('inicializado', true)
    } catch (e) {
      this.cambiar({ estado: 'decidir', error: (e as Error).message })
      return
    }
    await this.sincronizar()
  }

  /** Decisión del usuario: reemplazar la nube con lo de este dispositivo. */
  async subirEsteDispositivo() {
    const remoto = this.remoto
    if (!remoto) return
    this.cambiar({ estado: 'sincronizando', comparacion: null })
    try {
      const nube = await this.bajarTodo(remoto)
      // Lo que está en la nube y no aquí se marcará como borrado al subir.
      await this.db.transaction('rw', this.db.pendientes, async () => {
        await this.db.pendientes.bulkPut(
          nube.filter((f) => !f.borrado && f.tabla !== 'proyecto')
            .map((f) => ({ tabla: f.tabla, clave: claveDe(f.tabla, f.id), momento: 'reemplazo' })),
        )
      })
      await this.anotarTodoLocal()
      await this.guardarMeta('inicializado', true)
    } catch (e) {
      this.cambiar({ estado: 'decidir', error: (e as Error).message })
      return
    }
    await this.sincronizar()
  }

  // ---------- subir ----------

  private async subir(remoto: Remoto) {
    for (let vuelta = 0; vuelta < 1000; vuelta++) {
      const lote: Pendiente[] = await this.db.pendientes.limit(LOTE_SUBIDA).toArray()
      if (!lote.length) return
      const filas = await this.filasDe(lote)
      if (filas.length) await remoto.subir(filas)
      // Quitar de pendientes solo lo que no se volvió a cambiar mientras se subía.
      await this.db.transaction('rw', this.db.pendientes, async () => {
        for (const p of lote) {
          const actual = await this.db.pendientes.get([p.tabla, p.clave])
          if (actual && actual.momento === p.momento) await this.db.pendientes.delete([p.tabla, p.clave])
        }
      })
    }
  }

  private async filasDe(lote: Pendiente[]): Promise<FilaRemota[]> {
    const filas: FilaRemota[] = []
    const porTabla = new Map<TablaSinc, Pendiente[]>()
    for (const p of lote) porTabla.set(p.tabla, [...(porTabla.get(p.tabla) ?? []), p])
    for (const [tabla, ps] of porTabla) {
      const valores = await this.db.table(tabla).bulkGet(ps.map((p) => p.clave))
      ps.forEach((p, i) => {
        let v = valores[i] as Record<string, unknown> | undefined
        if (tabla === 'proyecto') {
          if (!v) return // el proyecto nunca se borra en la nube
          v = sinCamposLocales(v) as Record<string, unknown>
        }
        filas.push({ tabla, id: String(p.clave), datos: v ?? null, borrado: !v })
      })
    }
    return filas
  }

  // ---------- bajar ----------

  private async bajar(remoto: Remoto) {
    const cursor = (await this.leerMeta('cursor')) as string | null
    const desde = cursor ? new Date(new Date(cursor).getTime() - MARGEN_MS).toISOString() : null
    const filas = await this.bajarTodo(remoto, desde)
    if (!filas.length) return
    await this.aplicar(filas, false)
  }

  private async bajarTodo(remoto: Remoto, desde: string | null = null): Promise<FilaRemota[]> {
    const todas: FilaRemota[] = []
    let d = desde
    for (;;) {
      const filas = await remoto.bajar(d, LOTE_BAJADA)
      todas.push(...filas)
      if (filas.length < LOTE_BAJADA) break
      d = filas[filas.length - 1].actualizado_en ?? null
    }
    return todas
  }

  /** Guarda en este dispositivo lo que llegó de la nube (sin volver a anotarlo como pendiente). */
  private async aplicar(filas: FilaRemota[], reemplazar: boolean) {
    const tablas = TABLAS_SINC.map((t) => this.db.table(t))
    await this.db.transaction('rw', [...tablas, this.db.pendientes, this.db.sinc], async (tx) => {
      marcarRemota(tx)
      if (reemplazar) {
        for (const t of TABLAS_SINC) if (t !== 'proyecto') await this.db.table(t).clear()
        await this.db.pendientes.clear()
      }
      const pendientes = new Set((await this.db.pendientes.toArray()).map((p) => llave(p.tabla, p.clave)))
      const guardar = new Map<TablaSinc, unknown[]>()
      const borrar = new Map<TablaSinc, (number | string)[]>()
      for (const f of filas) {
        if (!TABLAS_SINC.includes(f.tabla)) continue
        const clave = claveDe(f.tabla, f.id)
        if (pendientes.has(llave(f.tabla, clave))) continue
        if (f.borrado || !f.datos) {
          if (f.tabla !== 'proyecto') borrar.set(f.tabla, [...(borrar.get(f.tabla) ?? []), clave])
        } else if (f.tabla === 'proyecto') {
          const local = (await this.db.proyecto.get(1)) as Proyecto | undefined
          const marcas = Object.fromEntries(CAMPOS_LOCALES_PROYECTO.map((c) => [c, local?.[c]]))
          await this.db.proyecto.put({ ...(f.datos as unknown as Proyecto), ...marcas, id: 1 })
        } else guardar.set(f.tabla, [...(guardar.get(f.tabla) ?? []), f.datos])
      }
      for (const [t, claves] of borrar) await this.db.table(t).bulkDelete(claves)
      for (const [t, valores] of guardar) await this.db.table(t).bulkPut(valores)
      const ultima = filas.reduce<string | null>(
        (m, f) => (f.actualizado_en && (!m || f.actualizado_en > m) ? f.actualizado_en : m),
        null,
      )
      if (ultima) await this.db.sinc.put({ clave: 'cursor', valor: ultima })
    })
  }

  // ---------- utilidades ----------

  private async anotarTodoLocal() {
    await this.db.transaction('rw', [...TABLAS_SINC.map((t) => this.db.table(t)), this.db.pendientes], async () => {
      for (const t of TABLAS_SINC) {
        const claves = (await this.db.table(t).toCollection().primaryKeys()) as (number | string)[]
        await this.db.pendientes.bulkPut(claves.map((clave) => ({ tabla: t, clave, momento: 'inicial' })))
      }
    })
  }

  private async hayDatosLocales(): Promise<boolean> {
    for (const t of TABLAS_DATOS) if ((await this.db.table(t).count()) > 0) return true
    return false
  }

  private async contarLocal(): Promise<Record<string, number>> {
    const r: Record<string, number> = {}
    for (const t of TABLAS_DATOS) r[t] = await this.db.table(t).count()
    return r
  }

  /** ¿Todo lo de este dispositivo ya está, idéntico, en la nube? (entonces no se pierde nada) */
  private async localIncluidoEn(nube: FilaRemota[]): Promise<boolean> {
    const enNube = new Map(nube.filter((f) => !f.borrado && f.datos).map((f) => [llave(f.tabla, f.id), jsonEstable(f.datos)]))
    for (const t of TABLAS_DATOS) {
      const tabla = this.db.table(t)
      const clave = tabla.schema.primKey.keyPath as string
      for (const v of await tabla.toArray()) {
        const normal = JSON.parse(JSON.stringify(v)) as Record<string, unknown>
        if (enNube.get(llave(t, v[clave])) !== jsonEstable(normal)) return false
      }
    }
    return true
  }

  private async leerMeta(clave: string): Promise<unknown> {
    return (await this.db.sinc.get(clave))?.valor ?? null
  }

  private async guardarMeta(clave: string, valor: unknown) {
    await this.db.sinc.put({ clave, valor })
  }
}

function contarFilas(filas: FilaRemota[]): Record<string, number> {
  const r: Record<string, number> = Object.fromEntries(TABLAS_DATOS.map((t) => [t, 0]))
  for (const f of filas) if (!f.borrado && f.tabla in r) r[f.tabla]++
  return r
}
