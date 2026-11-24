import 'fake-indexeddb/auto'
import { BaseVoluntarios } from '../db/db'
import type { Congregacion } from '../db/tipos'
import {
  CongregacionConVoluntarios, FORM_CONGREGACION_VACIO, congregacionAForm, duplicadosCongregacion,
  eliminarCongregacion, formACongregacion, ordenarCongregaciones, reasignarVoluntarios, validarCongregacion,
} from './congregaciones'
import { esAndroid, intentWhatsappHref, waMeHref, whatsappHref } from './whatsapp'

const cong = (id: number, nombre: string, numero = ''): Congregacion => ({
  id, nombre, numero, coordinadorNombre: '', coordinadorCelular: '', otroContactoNombre: '', otroContactoCelular: '',
})

describe('congregaciones: formulario', () => {
  it('exige el nombre y valida número y celulares solo si se escriben', () => {
    expect(validarCongregacion(FORM_CONGREGACION_VACIO).nombre).toBeTruthy()
    const ok = { ...FORM_CONGREGACION_VACIO, nombre: 'Norte', numero: '12345', coordinadorCelular: '300 123 4567' }
    expect(validarCongregacion(ok)).toEqual({})
    expect(validarCongregacion({ ...ok, numero: '12a' }).numero).toBeTruthy()
    expect(validarCongregacion({ ...ok, coordinadorCelular: '123' }).coordinadorCelular).toBeTruthy()
    expect(validarCongregacion({ ...ok, otroContactoCelular: '2001234567' }).otroContactoCelular).toBeTruthy()
  })

  it('limpia lo que se guarda y lo vuelve a formatear al editar', () => {
    const datos = formACongregacion({
      ...FORM_CONGREGACION_VACIO,
      nombre: '  Villa   del Sol ',
      numero: ' 123 ',
      coordinadorCelular: '+57 300-123-4567',
    })
    expect(datos.nombre).toBe('Villa del Sol')
    expect(datos.numero).toBe('123')
    expect(datos.coordinadorCelular).toBe('3001234567')
    expect(congregacionAForm(datos).coordinadorCelular).toBe('300 123 4567')
  })

  it('avisa duplicados por nombre (sin tildes ni mayúsculas) y por número, sin contarse a sí misma', () => {
    const todas = [cong(1, 'Bolívar', '100'), cong(2, 'Norte', '200')]
    expect(duplicadosCongregacion({ nombre: 'bolivar', numero: '' }, todas).nombre?.id).toBe(1)
    expect(duplicadosCongregacion({ nombre: 'Otra', numero: '200' }, todas).numero?.id).toBe(2)
    expect(duplicadosCongregacion({ nombre: 'Bolívar', numero: '100' }, todas, 1)).toEqual({ nombre: undefined, numero: undefined })
  })

  it('ordena alfabéticamente sin importar tildes', () => {
    expect(ordenarCongregaciones([cong(1, 'Norte'), cong(2, 'Ávila'), cong(3, 'centro')]).map((c) => c.id)).toEqual([2, 3, 1])
  })
})

describe('congregaciones: borrado y reasignación', () => {
  let db: BaseVoluntarios
  beforeEach(async () => {
    db = new BaseVoluntarios(`prueba-cong-${Math.random()}`)
    await db.open()
  })
  afterEach(async () => {
    await db.ultimaMarca
    await db.delete()
  })

  async function voluntarioEn(congregacionId: number) {
    const ahora = new Date().toISOString()
    return db.voluntarios.add({
      nombre: 'Ana', nombreNorm: '', congregacionId, invitado: false, invitadoMotivo: '', invitadoPor: '',
      tipo: 'Local', fechaNacimiento: '', profesion: '', profesionNorm: '', celulares: [],
      emergenciaNombre: '', emergenciaCelular: '', disponibilidad: Array(7).fill(null),
      observaciones: '', creado: ahora, actualizado: ahora,
    })
  }

  it('no deja borrar si tiene voluntarios; al reasignarlos sí', async () => {
    const a = await db.congregaciones.add(formACongregacion({ ...FORM_CONGREGACION_VACIO, nombre: 'A' }))
    const b = await db.congregaciones.add(formACongregacion({ ...FORM_CONGREGACION_VACIO, nombre: 'B' }))
    await voluntarioEn(a)
    await voluntarioEn(a)

    await expect(eliminarCongregacion(db, a)).rejects.toBeInstanceOf(CongregacionConVoluntarios)
    expect(await db.congregaciones.get(a)).toBeTruthy()

    expect(await reasignarVoluntarios(db, a, b)).toBe(2)
    expect(await db.voluntarios.where('congregacionId').equals(b).count()).toBe(2)

    await eliminarCongregacion(db, a)
    expect(await db.congregaciones.get(a)).toBeUndefined()
  })

  it('no reasigna a una congregación que no existe', async () => {
    const a = await db.congregaciones.add(formACongregacion({ ...FORM_CONGREGACION_VACIO, nombre: 'A' }))
    await voluntarioEn(a)
    await expect(reasignarVoluntarios(db, a, 999)).rejects.toThrow()
    expect(await db.voluntarios.where('congregacionId').equals(a).count()).toBe(1)
  })
})

describe('whatsapp', () => {
  it('en Android usa el intent del WhatsApp normal (com.whatsapp) con respaldo a wa.me', () => {
    const url = intentWhatsappHref('300 123 4567', 'Hola José')
    expect(url).toMatch(/^intent:\/\/send\/\?phone=573001234567&text=Hola%20Jos%C3%A9#Intent;/)
    expect(url).toContain(';scheme=whatsapp;package=com.whatsapp;')
    expect(url).not.toContain('w4b')
    expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent('https://wa.me/573001234567?text=Hola%20Jos%C3%A9')}`)
    expect(url.endsWith(';end')).toBe(true)
  })

  it('en el PC usa wa.me', () => {
    expect(waMeHref('+57 3001234567')).toBe('https://wa.me/573001234567')
    expect(whatsappHref('3001234567', '', false)).toBe('https://wa.me/573001234567')
    expect(whatsappHref('3001234567', '', true)).toMatch(/^intent:/)
  })

  it('detecta Android por el agente de usuario', () => {
    expect(esAndroid('Mozilla/5.0 (Linux; Android 14; SM-A546E) Chrome/130')).toBe(true)
    expect(esAndroid('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130')).toBe(false)
  })
})
