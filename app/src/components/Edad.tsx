import { alertaEdad, edad } from '../lib/fechas'

// Edad con alerta de menor/mayor según los límites de Ajustes (PLAN.md §2.4).
export default function Edad({
  fechaNacimiento,
  limites,
  soloAlerta = false,
}: {
  fechaNacimiento: string
  limites: { edadMenor: number; edadMayor: number }
  /** Muestra solo la insignia cuando hay alerta (para tarjetas). */
  soloAlerta?: boolean
}) {
  const años = edad(fechaNacimiento)
  if (años === null) return null
  const alerta = alertaEdad(años, limites)
  const texto = `${años} ${años === 1 ? 'año' : 'años'}`
  if (!alerta) return soloAlerta ? null : <span>{texto}</span>
  const clase =
    alerta === 'menor'
      ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/50 dark:text-amber-100'
      : 'bg-purple-100 text-purple-900 dark:bg-purple-900/50 dark:text-purple-100'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${clase}`}>
      {texto} · {alerta === 'menor' ? `menor de ${limites.edadMenor}` : `mayor de ${limites.edadMayor}`}
    </span>
  )
}
