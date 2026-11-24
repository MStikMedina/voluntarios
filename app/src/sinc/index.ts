// Punto de entrada de la sincronización: un único sincronizador para la base de la app.
import { db } from '../db/db'
import { Sincronizador } from './motor'

// Proyecto de Supabase. La clave "publishable" es pública por diseño (va dentro de la web);
// se pueden cambiar con VITE_SUPABASE_URL y VITE_SUPABASE_KEY al compilar.
const URL_NUBE = import.meta.env.VITE_SUPABASE_URL ?? 'https://sckopevjidrxdlsnxmca.supabase.co'
const CLAVE_NUBE = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_pDTc8i3wwg5ahO29LGRipQ_3s_qdNGJ'

export const sincronizador = new Sincronizador(db)

/** Arranca la sincronización (carga el cliente de Supabase aparte para no demorar el inicio). */
export async function iniciarSincronizacion() {
  if (!URL_NUBE || !CLAVE_NUBE) return
  const { crearRemotoSupabase } = await import('./supabase')
  sincronizador.iniciar(crearRemotoSupabase(URL_NUBE, CLAVE_NUBE))
}
