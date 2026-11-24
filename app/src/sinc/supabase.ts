// Conexión con Supabase (tabla `registros`, ver supabase/esquema.sql en la raíz del repo).
import { createClient } from '@supabase/supabase-js'
import type { FilaRemota, Remoto } from './motor'
import { TABLAS_DATOS } from './motor'

export function crearRemotoSupabase(url: string, clave: string): Remoto {
  const sb = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  return {
    async subir(filas) {
      const { error } = await sb
        .from('registros')
        .upsert(filas.map(({ tabla, id, datos, borrado }) => ({ tabla, id, datos, borrado })))
      if (error) throw new Error(`No se pudo subir: ${error.message}`)
    },

    async bajar(desde, limite) {
      let q = sb
        .from('registros')
        .select('tabla, id, datos, borrado, actualizado_en')
        .order('actualizado_en', { ascending: true })
        .limit(limite)
      if (desde) q = q.gt('actualizado_en', desde)
      const { data, error } = await q
      if (error) throw new Error(`No se pudo descargar: ${error.message}`)
      return data as FilaRemota[]
    },

    async hayDatos() {
      const { data, error } = await sb
        .from('registros')
        .select('id')
        .eq('borrado', false)
        .in('tabla', [...TABLAS_DATOS])
        .limit(1)
      if (error) throw new Error(`No se pudo consultar la nube: ${error.message}`)
      return data.length > 0
    },

    escuchar(alCambiar) {
      const canal = sb
        .channel('registros')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registros' }, () => alCambiar())
        .subscribe()
      return () => void sb.removeChannel(canal)
    },
  }
}
