// Botones de opción única en fila (segmentados).
export default function Opciones<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiqueta,
}: {
  valor: T
  opciones: { valor: T; texto: string }[]
  onCambiar: (v: T) => void
  etiqueta?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={etiqueta}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          aria-pressed={valor === o.valor}
          onClick={() => onCambiar(o.valor)}
          className={`rounded-lg px-3 py-2 text-sm font-medium ${
            valor === o.valor
              ? 'bg-primario-600 text-white'
              : 'bg-slate-100 text-slate-700 active:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:active:bg-slate-700'
          }`}
        >
          {o.texto}
        </button>
      ))}
    </div>
  )
}
