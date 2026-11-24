// Enlaces de WhatsApp (PLAN.md §2.5). En Android se abre SIEMPRE el WhatsApp normal
// (paquete com.whatsapp), nunca Business ni el clon, con un intent de Android.
// En el PC (o si no es Android) se usa https://wa.me/57…
import { celularInternacional } from './telefono'

export const PAQUETE_WHATSAPP = 'com.whatsapp'

export function esAndroid(agente: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /android/i.test(agente)
}

/** https://wa.me/573001234567?text=… */
export function waMeHref(numero: string, texto = ''): string {
  const t = texto ? `?text=${encodeURIComponent(texto)}` : ''
  return `https://wa.me/${celularInternacional(numero)}${t}`
}

/**
 * intent://send/?phone=57…&text=…#Intent;scheme=whatsapp;package=com.whatsapp;…;end
 * Si WhatsApp normal no está instalado, Chrome abre wa.me (browser_fallback_url).
 */
export function intentWhatsappHref(numero: string, texto = ''): string {
  const tel = celularInternacional(numero)
  const t = texto ? `&text=${encodeURIComponent(texto)}` : ''
  const respaldo = encodeURIComponent(waMeHref(numero, texto))
  return `intent://send/?phone=${tel}${t}#Intent;scheme=whatsapp;package=${PAQUETE_WHATSAPP};S.browser_fallback_url=${respaldo};end`
}

/** Enlace de WhatsApp según el dispositivo: intent en Android, wa.me en el resto. */
export function whatsappHref(numero: string, texto = '', android = esAndroid()): string {
  return android ? intentWhatsappHref(numero, texto) : waMeHref(numero, texto)
}
