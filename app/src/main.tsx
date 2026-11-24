import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { solicitarPersistencia } from './db/persistencia'

import { iniciarSincronizacion } from './sinc'

// Pedir desde el inicio que el navegador no borre los datos (IndexedDB).
void solicitarPersistencia()
// Sincronizar con la nube (en segundo plano; la app funciona igual sin internet).
void iniciarSincronizacion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
