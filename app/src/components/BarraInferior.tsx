import { NavLink } from 'react-router-dom'
import { IconoAsistencia, IconoInicio, IconoMas, IconoProgramacion, IconoVoluntarios } from './Iconos'

const items = [
  { to: '/', texto: 'Inicio', Icono: IconoInicio, end: true },
  { to: '/voluntarios', texto: 'Voluntarios', Icono: IconoVoluntarios, end: false },
  { to: '/programacion', texto: 'Programación', Icono: IconoProgramacion, end: false },
  { to: '/asistencia', texto: 'Asistencia', Icono: IconoAsistencia, end: false },
  { to: '/mas', texto: 'Más', Icono: IconoMas, end: false },
]

export default function BarraInferior() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-slate-800 dark:bg-slate-900/95"
      aria-label="Navegación principal"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {items.map(({ to, texto, Icono, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'text-primario-600 dark:text-primario-300'
                    : 'text-slate-500 dark:text-slate-400'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`flex h-7 w-12 items-center justify-center rounded-full ${
                      isActive ? 'bg-primario-100 dark:bg-primario-900' : ''
                    }`}
                  >
                    <Icono className="h-5 w-5" />
                  </span>
                  {texto}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
