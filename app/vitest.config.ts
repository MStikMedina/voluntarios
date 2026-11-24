import { defineConfig } from 'vitest/config'

// Config de pruebas aparte (sin el plugin PWA) para la lógica pura de src/.
// globals: true y SIN `import ... from 'vitest'` en las pruebas: con la tilde de
// "Construcción" en la ruta, importar 'vitest' carga una segunda copia y falla
// ("Cannot read properties of undefined (reading 'config')").
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'], globals: true },
})
