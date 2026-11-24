import { Link } from 'react-router-dom'
import Pagina from '../components/Pagina'
import { IconoFlecha } from '../components/Iconos'
import { seccionesMas } from './secciones'
import EstadoDatos from '../components/EstadoDatos'
import EstadoNube from '../components/EstadoNube'

export default function Mas() {
  return (
    <Pagina titulo="Más">
      <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl bg-white shadow-sm dark:divide-slate-800 dark:bg-slate-900">
        {seccionesMas.map((s) => (
          <li key={s.ruta}>
            <Link
              to={`/mas/${s.ruta}`}
              className="flex items-center justify-between px-4 py-4 active:bg-slate-100 dark:active:bg-slate-800"
            >
              <span>
                <span className="block font-medium">{s.titulo}</span>
                <span className="block text-sm text-slate-500 dark:text-slate-400">{s.detalle}</span>
              </span>
              <IconoFlecha className="h-5 w-5 text-slate-400" />
            </Link>
          </li>
        ))}
      </ul>
      <EstadoNube />
      <EstadoDatos />
      <p className="mt-6 text-center text-xs text-slate-400">Voluntarios · versión {__VERSION__}</p>
    </Pagina>
  )
}
