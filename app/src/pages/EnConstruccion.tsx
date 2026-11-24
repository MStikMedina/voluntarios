import { Link, Navigate, useParams } from 'react-router-dom'
import Pagina, { Vacio } from '../components/Pagina'
import { seccionesMas } from './secciones'

export default function EnConstruccion() {
  const { seccion } = useParams()
  const s = seccionesMas.find((x) => x.ruta === seccion)
  if (!s) return <Navigate to="/mas" replace />
  return (
    <Pagina titulo={s.titulo}>
      <Vacio texto={`Esta sección llegará en la Fase ${s.fase}.`} />
      <Link to="/mas" className="mt-4 block text-center font-medium text-primario-600 dark:text-primario-300">
        ← Volver a Más
      </Link>
    </Pagina>
  )
}
