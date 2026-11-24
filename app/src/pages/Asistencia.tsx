import Pagina, { Vacio } from '../components/Pagina'
import BotonEmergencia from '../components/BotonEmergencia'

export default function Asistencia() {
  return (
    <Pagina titulo="Asistencia">
      <BotonEmergencia />
      <Vacio texto="La asistencia llegará en la Fase 13." />
    </Pagina>
  )
}
