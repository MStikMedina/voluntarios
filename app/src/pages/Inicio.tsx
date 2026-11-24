import Pagina, { Vacio } from '../components/Pagina'
import BotonEmergencia from '../components/BotonEmergencia'

export default function Inicio() {
  return (
    <Pagina titulo="Inicio">
      <BotonEmergencia />
      <Vacio texto="El panel de inicio llegará en la Fase 14." />
    </Pagina>
  )
}
