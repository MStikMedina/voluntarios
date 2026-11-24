// Pide al navegador que no borre los datos de la app cuando falte espacio (PLAN §2.1).

export type EstadoPersistencia = 'persistente' | 'no_persistente' | 'no_soportado'

export async function solicitarPersistencia(): Promise<EstadoPersistencia> {
  const s = globalThis.navigator?.storage
  if (!s?.persist || !s.persisted) return 'no_soportado'
  try {
    if (await s.persisted()) return 'persistente'
    return (await s.persist()) ? 'persistente' : 'no_persistente'
  } catch {
    return 'no_persistente'
  }
}
