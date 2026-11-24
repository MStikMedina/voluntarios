import { useState } from 'react'
import Dialogo from './Dialogo'
import { OpcionesDecidir } from './EstadoNube'
import { useNube } from '../sinc/useNube'

// Aparece la primera vez que este dispositivo se conecta a la nube y ambos tienen datos distintos.
export default function AvisoNube() {
  const info = useNube()
  const [oculto, setOculto] = useState(false)
  if (info.estado !== 'decidir' || oculto) return null
  return (
    <Dialogo
      abierto
      titulo="Datos en la nube"
      onCerrar={() => setOculto(true)}
      acciones={
        <button type="button" onClick={() => setOculto(true)} className="px-2 py-2 text-sm text-slate-500">
          Decidir después (Más → Nube)
        </button>
      }
    >
      <OpcionesDecidir info={info} />
    </Dialogo>
  )
}
