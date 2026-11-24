// Datos de prueba (Fase 2): una congregación "(Prueba)" con 3 voluntarios.
// Sirven para comprobar que los datos siguen ahí al recargar. Se borran con un botón.
import { db } from './db'
import type { NuevoVoluntario } from './tipos'
import { parsearCodigosDisponibilidad } from '../lib/disponibilidad'

export const NOMBRE_CONGREGACION_PRUEBA = '(Prueba)'

function voluntario(
  congregacionId: number,
  nombre: string,
  profesion: string,
  fechaNacimiento: string,
  celular: string,
  disponibilidad: string,
): NuevoVoluntario {
  return {
    nombre,
    congregacionId,
    invitado: false,
    invitadoMotivo: '',
    invitadoPor: '',
    tipo: 'Local',
    fechaNacimiento,
    profesion,
    celulares: [{ numero: celular, principal: true }],
    emergenciaNombre: 'Contacto de prueba',
    emergenciaCelular: '3000000000',
    disponibilidad: parsearCodigosDisponibilidad(disponibilidad).disponibilidad,
    tareaHabitualId: null,
    observaciones: 'Dato de prueba',
  }
}

export async function crearDatosDePrueba() {
  await db.transaction('rw', db.congregaciones, db.voluntarios, async () => {
    const existente = await db.congregaciones.where('nombre').equals(NOMBRE_CONGREGACION_PRUEBA).first()
    const congId =
      existente?.id ??
      (await db.congregaciones.add({
        nombre: NOMBRE_CONGREGACION_PRUEBA,
        numero: '0000',
        coordinadorNombre: '',
        coordinadorCelular: '',
        otroContactoNombre: '',
        otroContactoCelular: '',
      }))
    const ahora = new Date().toISOString()
    const nuevos = [
      voluntario(congId, 'José Pérez Gómez', 'Pintor', '1980-05-14', '3001112233', 'SA-D'),
      voluntario(congId, 'María Fernanda López', 'Electricista', '2010-02-01', '3104445566', 'LU-M, SA-T'),
      voluntario(congId, 'Ángel Ramírez', 'Albañil y plomería', '1955-09-30', '3207778899', 'MI-T, SA-D'),
    ]
    await db.voluntarios.bulkAdd(
      nuevos.map((v) => ({ ...v, nombreNorm: '', profesionNorm: '', creado: ahora, actualizado: ahora })),
    )
  })
}

export async function borrarDatosDePrueba() {
  await db.transaction('rw', db.congregaciones, db.voluntarios, async () => {
    const congs = await db.congregaciones.where('nombre').equals(NOMBRE_CONGREGACION_PRUEBA).toArray()
    for (const c of congs) {
      await db.voluntarios.where('congregacionId').equals(c.id).delete()
      await db.congregaciones.delete(c.id)
    }
  })
}
