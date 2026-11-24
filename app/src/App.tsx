import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Inicio from './pages/Inicio'
import Voluntarios from './pages/Voluntarios'
import Programacion from './pages/Programacion'
import Asistencia from './pages/Asistencia'
import Mas from './pages/Mas'
import EnConstruccion from './pages/EnConstruccion'
import Ajustes from './pages/Ajustes'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="voluntarios" element={<Voluntarios />} />
        <Route path="programacion" element={<Programacion />} />
        <Route path="asistencia" element={<Asistencia />} />
        <Route path="mas" element={<Mas />} />
        <Route path="mas/ajustes" element={<Ajustes />} />
        <Route path="mas/:seccion" element={<EnConstruccion />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
