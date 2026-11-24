import 'fake-indexeddb/auto'
import { BaseVoluntarios, PROYECTO_POR_DEFECTO, PLANTILLAS_INICIALES } from '../db/db'
import { mensajeDePlantilla, primerNombre, textoProgramacion, variablesMensaje } from './mensajes'
import { restaurarPlantillasIniciales } from './plantillas'
import { intentWhatsappHref, whatsappTextoHref } from './whatsapp'

const proyecto = { ...PROYECTO_POR_DEFECTO, nombre: 'Remodelación Salón Central', direccion: 'Calle 1 # 2-3' }

describe('mensajes', () => {
  it('variables y plantilla de recordatorio', () => {
    const vars = variablesMensaje({ voluntario: { nombre: 'José Pérez Gómez' }, proyecto, fecha: '2026-12-05', jornada: 'M', tarea: { nombre: 'Pintura' } })
    expect(vars).toEqual({
      nombre: 'José', proyecto: 'Remodelación Salón Central', fecha: 'sábado 05/12/2026', jornada: 'mañana',
      hora: '7:00 a. m. a 12:00 p. m.', tarea: 'Pintura',
    })
    expect(mensajeDePlantilla(PLANTILLAS_INICIALES[0].texto, vars)).toBe(
      'Hola José, le recordamos que está programado(a) para la remodelación del Salón del Reino el sábado 05/12/2026 en la jornada de la mañana (7:00 a. m. a 12:00 p. m.). Tarea: Pintura. ¡Muchas gracias!',
    )
    expect(variablesMensaje({ voluntario: { nombre: 'Ana' }, proyecto: { ...proyecto, nombre: '' } }).proyecto).toBe('la remodelación del Salón del Reino')
    expect(primerNombre('  María Fernanda ')).toBe('María')
  })

  it('texto de la programación del día', () => {
    const t = textoProgramacion({
      proyecto,
      fecha: '2026-12-05',
      jornadas: ['M', 'T'],
      programaciones: [
        { jornada: 'M', voluntarioId: 1, tareaId: 1, confirmacion: 'confirmado' },
        { jornada: 'M', voluntarioId: 2, tareaId: null, confirmacion: 'pendiente' },
        { jornada: 'M', voluntarioId: 3, tareaId: 1, confirmacion: 'no_puede' },
      ],
      voluntarios: new Map([
        [1, { nombre: 'José Pérez', celulares: [{ numero: '3001112233', principal: true }] }],
        [2, { nombre: 'Ana Ruiz', celulares: [] }],
        [3, { nombre: 'Luis', celulares: [] }],
      ]),
      tareas: [{ id: 1, nombre: 'Pintura' }],
    })
    expect(t).toBe(
      [
        '*Remodelación Salón Central*',
        '📅 *Programación sábado 05/12/2026*',
        '📍 Calle 1 # 2-3',
        '',
        '*MAÑANA* (7:00 a. m. a 12:00 p. m.) — 2 personas',
        '▪ _Pintura_',
        '   • José Pérez ✅ – 300 111 2233',
        '▪ _Sin tarea asignada_',
        '   • Ana Ruiz',
        '',
        '*TARDE* (1:00 p. m. a 5:00 p. m.) — 0 personas',
        '_Nadie programado_',
      ].join('\n'),
    )
  })

  it('enlaces de WhatsApp con texto', () => {
    expect(intentWhatsappHref('3001112233', 'Hola José')).toContain('phone=573001112233&text=Hola%20Jos%C3%A9#Intent;scheme=whatsapp;package=com.whatsapp;')
    expect(whatsappTextoHref('a b', false)).toBe('https://wa.me/?text=a%20b')
    expect(whatsappTextoHref('a b', true)).toMatch(/^intent:\/\/send\/\?text=a%20b#Intent;scheme=whatsapp;package=com\.whatsapp;/)
  })

  it('restaura las plantillas iniciales que falten', async () => {
    const db = new BaseVoluntarios('mensajes-1')
    await db.plantillas.delete(1)
    await db.plantillas.update(2, { texto: 'cambiado' })
    expect(await restaurarPlantillasIniciales(db)).toBe(1)
    expect(await db.plantillas.count()).toBe(4)
    expect((await db.plantillas.get(2))?.texto).toBe('cambiado')
  })
})
