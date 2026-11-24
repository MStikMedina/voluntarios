import Pagina, { Vacio } from '../components/Pagina'
import BotonEmergencia from '../components/BotonEmergencia'
import AvisoRespaldo from '../components/AvisoRespaldo'

export default function Inicio() {
  return (
    <Pagina titulo="Inicio">
      <AvisoRespaldo />
      <BotonEmergencia />
      <Vacio texto="El panel de inicio llegará en la Fase 14." />
    </Pagina>
  )
}
