import { lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'

// Cada pantalla se carga cuando se abre (la app arranca más rápido). Todas quedan guardadas
// para usarse sin internet (el service worker las precachea).
const Voluntarios = lazy(() => import('./pages/Voluntarios'))
const VoluntarioForm = lazy(() => import('./pages/VoluntarioForm'))
const VoluntarioFicha = lazy(() => import('./pages/VoluntarioFicha'))
const Emergencia = lazy(() => import('./pages/Emergencia'))
const Programacion = lazy(() => import('./pages/Programacion'))
const EnvioGuiado = lazy(() => import('./pages/EnvioGuiado'))
const ProgramacionHoja = lazy(() => import('./pages/ProgramacionHoja'))
const Asistencia = lazy(() => import('./pages/Asistencia'))
const Mas = lazy(() => import('./pages/Mas'))
const Ajustes = lazy(() => import('./pages/Ajustes'))
const Congregaciones = lazy(() => import('./pages/Congregaciones'))
const CongregacionForm = lazy(() => import('./pages/CongregacionForm'))
const Respaldo = lazy(() => import('./pages/Respaldo'))
const CargaMasiva = lazy(() => import('./pages/CargaMasiva'))
const Tareas = lazy(() => import('./pages/Tareas'))
const TareaForm = lazy(() => import('./pages/TareaForm'))
const Mensajes = lazy(() => import('./pages/Mensajes'))
const PlantillaForm = lazy(() => import('./pages/PlantillaForm'))
const Exportar = lazy(() => import('./pages/Exportar'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="voluntarios" element={<Voluntarios />} />
        <Route path="voluntarios/nuevo" element={<VoluntarioForm />} />
        <Route path="voluntarios/:id" element={<VoluntarioFicha />} />
        <Route path="voluntarios/:id/editar" element={<VoluntarioForm />} />
        <Route path="emergencia" element={<Emergencia />} />
        <Route path="programacion" element={<Programacion />} />
        <Route path="programacion/enviar" element={<EnvioGuiado />} />
        <Route path="programacion/hoja" element={<ProgramacionHoja />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="mas" element={<Mas />} />
        <Route path="mas/ajustes" element={<Ajustes />} />
        <Route path="mas/congregaciones" element={<Congregaciones />} />
        <Route path="mas/congregaciones/:id" element={<CongregacionForm />} />
        <Route path="mas/respaldo" element={<Respaldo />} />
        <Route path="mas/carga-masiva" element={<CargaMasiva />} />
        <Route path="mas/tareas" element={<Tareas />} />
        <Route path="mas/tareas/:id" element={<TareaForm />} />
        <Route path="mas/mensajes" element={<Mensajes />} />
        <Route path="mas/mensajes/:id" element={<PlantillaForm />} />
        <Route path="mas/exportar" element={<Exportar />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
