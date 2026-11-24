import type { EstadoTarea } from '../db/tipos'
import { NOMBRE_ESTADO } from '../lib/tareas'

const COLOR_ESTADO: Record<EstadoTarea, string> = {
  pendiente: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  en_curso: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100',
  terminada: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-100',
}

export default function InsigniaEstado({ estado }: { estado: EstadoTarea }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${COLOR_ESTADO[estado]}`}>
      {NOMBRE_ESTADO[estado]}
    </span>
  )
}

