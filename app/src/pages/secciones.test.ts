import { seccionesMas } from './secciones'

describe('menú Más', () => {
  it('tiene las 7 secciones del plan con rutas únicas', () => {
    expect(seccionesMas.map((s) => s.titulo)).toEqual([
      'Congregaciones', 'Tareas', 'Mensajes', 'Exportar', 'Carga masiva', 'Respaldo', 'Ajustes',
    ])
    expect(new Set(seccionesMas.map((s) => s.ruta)).size).toBe(seccionesMas.length)
  })
})
