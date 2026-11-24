import type { Disponibilidad, Turno } from '../db/tipos'
import { ORDEN_SEMANA } from '../lib/disponibilidad'
import { NOMBRES_DIA } from '../lib/fechas'

// Disponibilidad semanal recurrente (PLAN.md §2.4): por cada día — / M / T / D.
// Sin `onCambiar` se muestra solo para leer (ficha).
const OPCIONES: { valor: Turno | null; texto: string; titulo: string }[] = [
  { valor: null, texto: '—', titulo: 'No disponible' },
  { valor: 'M', texto: 'M', titulo: 'Mañana' },
  { valor: 'T', texto: 'T', titulo: 'Tarde' },
  { valor: 'D', texto: 'D', titulo: 'Día completo' },
]

export default function SelectorDisponibilidad({
  valor,
  onCambiar,
  diasTrabajo = [],
}: {
  valor: Disponibilidad
  onCambiar?: (d: Disponibilidad) => void
  /** Días de trabajo del proyecto (se resaltan). */
  diasTrabajo?: number[]
}) {
  const soloLectura = !onCambiar

  if (soloLectura) {
    const dias = ORDEN_SEMANA.filter((d) => valor[d])
    if (dias.length === 0) return <p className="text-slate-500 dark:text-slate-400">Sin días disponibles.</p>
    return (
      <ul className="flex flex-wrap gap-2">
        {dias.map((d) => (
          <li
            key={d}
            className="rounded-lg bg-primario-50 px-3 py-1.5 text-sm text-primario-800 dark:bg-primario-900/40 dark:text-primario-100"
          >
            <b>{NOMBRES_DIA[d]}</b> · {OPCIONES.find((o) => o.valor === valor[d])?.titulo}
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div role="group" aria-label="Días disponibles" className="space-y-1.5">
      {ORDEN_SEMANA.map((d) => {
        const trabajo = diasTrabajo.includes(d)
        return (
          <div key={d} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-sm">
              {NOMBRES_DIA[d]}
              {trabajo && (
                <span className="ml-1 text-primario-600 dark:text-primario-300" title="Día de trabajo">
                  •
                </span>
              )}
            </span>
            <div className="grid flex-1 grid-cols-4 overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700">
              {OPCIONES.map((o) => {
                const activo = (valor[d] ?? null) === o.valor
                return (
                  <button
                    key={o.texto}
                    type="button"
                    aria-pressed={activo}
                    aria-label={`${NOMBRES_DIA[d]}: ${o.titulo}`}
                    title={o.titulo}
                    onClick={() => {
                      const nueva = [...valor]
                      nueva[d] = o.valor
                      onCambiar(nueva)
                    }}
                    className={`py-2 text-sm font-semibold not-first:border-l not-first:border-slate-300 dark:not-first:border-slate-700 ${
                      activo
                        ? o.valor
                          ? 'bg-primario-600 text-white'
                          : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-100'
                        : 'bg-white text-slate-500 active:bg-slate-100 dark:bg-slate-950 dark:text-slate-400 dark:active:bg-slate-800'
                    }`}
                  >
                    {o.texto}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="pt-1 text-xs text-slate-500 dark:text-slate-400">
        M = mañana · T = tarde · D = día completo{diasTrabajo.length > 0 && ' · • = día de trabajo del proyecto'}
      </p>
    </div>
  )
}
