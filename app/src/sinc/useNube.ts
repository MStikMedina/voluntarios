import { useSyncExternalStore } from 'react'
import { sincronizador } from '.'
import type { InfoNube } from './motor'

/** Estado de la sincronización con la nube (se actualiza solo). */
export function useNube(): InfoNube {
  return useSyncExternalStore(sincronizador.suscribir, sincronizador.obtenerInfo)
}
