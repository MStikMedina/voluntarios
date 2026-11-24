import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Voluntarios from './pages/Voluntarios'
import Programacion from './pages/Programacion'
import Asistencia from './pages/Asistencia'
import Mas from './pages/Mas'
import EnConstruccion from './pages/EnConstruccion'
import Ajustes from './pages/Ajustes'
import Congregaciones from './pages/Congregaciones'
import CongregacionForm from './pages/CongregacionForm'
import VoluntarioForm from './pages/VoluntarioForm'
import VoluntarioFicha from './pages/VoluntarioFicha'
import Emergencia from './pages/Emergencia'
import Respaldo from './pages/Respaldo'
import CargaMasiva from './pages/CargaMasiva'

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
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="mas" element={<Mas />} />
        <Route path="mas/ajustes" element={<Ajustes />} />
        <Route path="mas/congregaciones" element={<Congregaciones />} />
        <Route path="mas/congregaciones/:id" element={<CongregacionForm />} />
        <Route path="mas/respaldo" element={<Respaldo />} />
        <Route path="mas/carga-masiva" element={<CargaMasiva />} />
        <Route path="mas/:seccion" element={<EnConstruccion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
