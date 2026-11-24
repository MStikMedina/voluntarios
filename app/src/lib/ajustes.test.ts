import 'fake-indexeddb/auto'
import { formAProyecto, hayCambios, proyectoAForm, validarAjustes, type FormAjustes } from './ajustes'
import { BaseVoluntarios, PROYECTO_POR_DEFECTO } from '../db/db'

const valido = (): FormAjustes => ({
  ...proyectoAForm(PROYECTO_POR_DEFECTO),
  nombre: 'Remodelación Salón',
  fechaInicio: '2026-12-01',
  fechaFin: '2027-02-28',
})

describe('ajustes: validación', () => {
  it('un formulario completo no tiene errores', () => {
    expect(validarAjustes(valido())).toEqual({})
  })

  it('exige el nombre del proyecto', () => {
    expect(validarAjustes({ ...valido(), nombre: '   ' }).nombre).toBeTruthy()
  })

  it('la fecha de fin no puede quedar antes que la de inicio', () => {
    expect(validarAjustes({ ...valido(), fechaFin: '2026-11-30' }).fechaFin).toMatch(/antes/)
    expect(validarAjustes({ ...valido(), fechaFin: '2026-12-01' }).fechaFin).toBeUndefined()
    // Las fechas son opcionales.
    expect(validarAjustes({ ...valido(), fechaInicio: '', fechaFin: '' })).toEqual({})
    expect(validarAjustes({ ...valido(), fechaInicio: '2026-02-30' }).fechaInicio).toBeTruthy()
  })

  it('valida el celular del superintendente solo si se escribe', () => {
    expect(validarAjustes({ ...valido(), superintendenteCelular: '' })).toEqual({})
    expect(validarAjustes({ ...valido(), superintendenteCelular: '300 123 4567' })).toEqual({})
    expect(validarAjustes({ ...valido(), superintendenteCelular: '12345' }).superintendenteCelular).toBeTruthy()
  })

  it('exige al menos un día de trabajo', () => {
    expect(validarAjustes({ ...valido(), diasTrabajo: [] }).diasTrabajo).toBeTruthy()
  })

  it('valida los horarios de las jornadas', () => {
    expect(validarAjustes({ ...valido(), mFin: '06:00' }).jornadaM).toMatch(/después/)
    expect(validarAjustes({ ...valido(), tInicio: '' }).jornadaT).toBeTruthy()
    expect(validarAjustes({ ...valido(), tInicio: '11:00' }).jornadaT).toMatch(/mañana/)
    expect(validarAjustes({ ...valido(), tInicio: '12:00' })).toEqual({})
  })

  it('valida los límites de edad', () => {
    expect(validarAjustes({ ...valido(), edadMenor: '' }).edadMenor).toBeTruthy()
    expect(validarAjustes({ ...valido(), edadMenor: '17.5' }).edadMenor).toBeTruthy()
    expect(validarAjustes({ ...valido(), edadMayor: '200' }).edadMayor).toBeTruthy()
    expect(validarAjustes({ ...valido(), edadMenor: '70', edadMayor: '65' }).edadMayor).toBeTruthy()
  })
})

describe('ajustes: conversión y guardado', () => {
  it('limpia los textos, el celular y ordena los días', () => {
    const p = formAProyecto({
      ...valido(),
      nombre: '  Salón  ',
      superintendenteCelular: '+57 300 123 4567',
      diasTrabajo: [6, 0, 6, 3],
      edadMenor: '16',
    })
    expect(p.nombre).toBe('Salón')
    expect(p.superintendenteCelular).toBe('3001234567')
    expect(p.diasTrabajo).toEqual([0, 3, 6])
    expect(p.edadMenor).toBe(16)
  })

  it('detecta cambios sin contar el formato del celular', () => {
    const guardado = { ...PROYECTO_POR_DEFECTO, superintendenteCelular: '3001234567' }
    const f = proyectoAForm(guardado)
    expect(f.superintendenteCelular).toBe('300 123 4567')
    expect(hayCambios(f, guardado)).toBe(false)
    expect(hayCambios({ ...f, superintendenteCelular: '3001234567' }, guardado)).toBe(false)
    expect(hayCambios({ ...f, ciudad: 'Bucaramanga' }, guardado)).toBe(true)
  })

  it('se guarda y se vuelve a cargar igual', async () => {
    const db = new BaseVoluntarios('prueba-ajustes')
    const form = { ...valido(), ciudad: 'Bucaramanga', diasTrabajo: [5, 6], tFin: '18:00', frecuenciaRespaldo: 'semanal' as const }
    await db.guardarProyecto(formAProyecto(form))
    const leido = await db.obtenerProyecto()
    expect(hayCambios(form, leido)).toBe(false)
    expect(leido.jornadas.T.fin).toBe('18:00')
    expect(leido.ultimoCambio).toBeTruthy()
    db.close()
  })
})
