import { defineConfig, minimal2023Preset as preset } from '@vite-pwa/assets-generator/config'

// Genera los íconos PNG a partir de public/icono.svg:  npm run iconos
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...preset,
    maskable: { ...preset.maskable, resizeOptions: { background: '#1e4e8c' } },
    apple: { ...preset.apple, resizeOptions: { background: '#1e4e8c' } },
  },
  images: ['public/icono.svg'],
})
