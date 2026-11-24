// Íconos de línea simples (estilo 24x24, trazo actual). Sin dependencias externas.
type P = { className?: string }
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const IconoInicio = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
)

export const IconoVoluntarios = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
    <path d="M18 14a6.5 6.5 0 0 1 3.5 6" />
  </svg>
)

export const IconoProgramacion = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="4.5" width="18" height="16.5" rx="2" />
    <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    <path d="M8 14h3M8 17.5h6" />
  </svg>
)

export const IconoAsistencia = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="5" y="3.5" width="14" height="18" rx="2" />
    <path d="M9 3.5V2.5h6v1" />
    <path d="m8.5 13 2.5 2.5 4.5-5" />
  </svg>
)

export const IconoMas = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="19" cy="12" r="1.2" fill="currentColor" />
  </svg>
)

export const IconoFlecha = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="m9 5 7 7-7 7" />
  </svg>
)
