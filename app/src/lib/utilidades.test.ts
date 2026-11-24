import { coincide, normalizar } from './texto'
import {
  alertaEdad, diaSemana, edad, fechaLarga, formatoFecha, formatoHora, parsearFecha, sumarDias,
} from './fechas'
import { formatoCelular, limpiarCelular, telHref, validarCelular } from './telefono'
import {
  codigosDisponibilidad, disponibleEn, parsearCodigosDisponibilidad,
} from './disponibilidad'
import { horasDeJornada } from './horas'
import { rellenarPlantilla } from './plantillas'
import { PROYECTO_POR_DEFECTO } from '../db/db'

describe('texto', () => {
  it('normaliza tildes, mayúsculas y espacios', () => {
    expect(normalizar('  JOSÉ   Ángel  Muñoz ')).toBe('jose angel munoz')
    expect(normalizar(undefined)).toBe('')
  })
  it('busca por cualquier palabra en cualquier campo', () => {
    expect(coincide('jose pint', 'José Pérez Gómez', 'Pintor')).toBe(true)
    expect(coincide('PEREZ', 'José Pérez Gómez', '')).toBe(true)
    expect(coincide('jose electric', 'José Pérez Gómez', 'Pintor')).toBe(false)
    expect(coincide('   ', 'cualquiera')).toBe(true)
  })
})

describe('fechas', () => {
  it('formatea y lee dd/mm/aaaa', () => {
    expect(formatoFecha('2026-11-05')).toBe('05/11/2026')
    expect(formatoFecha('')).toBe('')
    expect(parsearFecha('5/11/2026')).toBe('2026-11-05')
    expect(parsearFecha('05-11-2026')).toBe('2026-11-05')
    expect(parsearFecha('31/02/2026')).toBeNull()
    expect(parsearFecha('2026-11-05')).toBeNull()
  })
  it('suma días y calcula el día de la semana', () => {
    expect(sumarDias('2026-11-28', 3)).toBe('2026-12-01')
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28')
    expect(diaSemana('2026-11-23')).toBe(1) // lunes
    expect(diaSemana('2026-11-29')).toBe(0) // domingo
    expect(fechaLarga('2026-11-28')).toBe('sábado 28/11/2026')
  })
  it('calcula la edad con cumpleaños exacto', () => {
    expect(edad('2008-11-23', '2026-11-23')).toBe(18)
    expect(edad('2008-11-24', '2026-11-23')).toBe(17)
    expect(edad('', '2026-11-23')).toBeNull()
  })
  it('alerta de menor y de mayor según los límites', () => {
    const lim = { edadMenor: 18, edadMayor: 65 }
    expect(alertaEdad(17, lim)).toBe('menor')
    expect(alertaEdad(18, lim)).toBeNull()
    expect(alertaEdad(65, lim)).toBeNull()
    expect(alertaEdad(66, lim)).toBe('mayor')
    expect(alertaEdad(null, lim)).toBeNull()
  })
  it('muestra la hora en 12 h', () => {
    expect(formatoHora('07:00')).toBe('7:00 a. m.')
    expect(formatoHora('00:15')).toBe('12:15 a. m.')
    expect(formatoHora('12:00')).toBe('12:00 p. m.')
    expect(formatoHora('17:30')).toBe('5:30 p. m.')
    expect(formatoHora('25:00')).toBe('')
  })
})

describe('teléfono', () => {
  it('valida 10 dígitos que empiezan por 3', () => {
    expect(validarCelular('300 123 4567')).toBe(true)
    expect(validarCelular('+57 300-123-4567')).toBe(true)
    expect(validarCelular('6012345678')).toBe(false)
    expect(validarCelular('30012345')).toBe(false)
  })
  it('limpia, formatea y arma el enlace de llamada', () => {
    expect(limpiarCelular('(+57) 310 444 5566')).toBe('3104445566')
    expect(formatoCelular('3104445566')).toBe('310 444 5566')
    expect(telHref('310 444 5566')).toBe('tel:+573104445566')
  })
})

describe('disponibilidad', () => {
  it('lee los códigos cortos y su inversa', () => {
    const { disponibilidad, errores } = parsearCodigosDisponibilidad('lu-m; MA-T  sá-d, XX-M, LU-Q')
    expect(disponibilidad).toEqual([null, 'M', 'T', null, null, null, 'D'])
    expect(errores).toEqual(['XX-M', 'LU-Q'])
    expect(codigosDisponibilidad(disponibilidad)).toBe('LU-M, MA-T, SA-D')
  })
  it('M y T del mismo día se combinan en D', () => {
    expect(parsearCodigosDisponibilidad('VI-M, VI-T').disponibilidad[5]).toBe('D')
  })
  it('D cuenta como disponible en mañana y tarde', () => {
    const vol = { disponibilidad: parsearCodigosDisponibilidad('SA-D, LU-M').disponibilidad }
    expect(disponibleEn(vol, '2026-11-28', 'M')).toBe(true) // sábado
    expect(disponibleEn(vol, '2026-11-28', 'T')).toBe(true)
    expect(disponibleEn(vol, '2026-11-23', 'M')).toBe(true) // lunes
    expect(disponibleEn(vol, '2026-11-23', 'T')).toBe(false)
    expect(disponibleEn(vol, '2026-11-24', 'M')).toBe(false) // martes
  })
})

describe('horas', () => {
  it('usa el horario configurado de la jornada', () => {
    const j = PROYECTO_POR_DEFECTO.jornadas // 07–12 y 13–17
    expect(horasDeJornada('M', j)).toBe(5)
    expect(horasDeJornada('T', j)).toBe(4)
    expect(horasDeJornada('D', j)).toBe(9)
    expect(horasDeJornada('M', { ...j, M: { inicio: '07:30', fin: '07:00' } })).toBe(0)
  })
})

describe('plantillas', () => {
  it('rellena las variables y deja las que no tienen valor', () => {
    expect(rellenarPlantilla('Hola {nombre}, el {fecha} ({otra})', { nombre: 'Ana', fecha: '28/11/2026' }))
      .toBe('Hola Ana, el 28/11/2026 ({otra})')
  })
})
