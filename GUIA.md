# Guía de uso — App «Voluntarios»

App para controlar a los voluntarios de la remodelación del Salón del Reino. Funciona **sin internet**:
guarda los datos en el dispositivo y, cuando hay conexión, los copia a la **nube** (Supabase). Así todos los
celulares y PCs que usen la app ven los mismos datos (ver §7).

Dirección: **https://mstikmedina.github.io/voluntarios/**

---

## 1. Instalar

1. En el celular Android, abra la dirección en **Chrome**.
2. Menú ⋮ → **Agregar a la pantalla principal** / **Instalar app**.
3. Ábrala desde el ícono. La primera vez aparece «La app ya funciona sin internet».
4. Cuando haya una versión nueva aparecerá **«Nueva versión disponible · Recargar»**: tóquelo.

> En el PC se usa la misma dirección. Los datos se pasan solos entre equipos a través de la nube.

## 2. Configurar (una sola vez)

En **Inicio** aparece «Primeros pasos». En orden:

1. **Más → Ajustes**: nombre del proyecto, ciudad, dirección, fechas, superintendente, **días de trabajo**,
   **horario** de mañana y tarde (con este horario se calculan las horas), edades de alerta y frecuencia del
   recordatorio de respaldo.
2. **Más → Congregaciones**: las congregaciones con su coordinador y otro contacto.
3. **Voluntarios**: uno por uno (**Nuevo voluntario**) o muchos a la vez (**Más → Carga masiva**).
4. **Más → Tareas**: los frentes de trabajo, con **personas necesarias** (cupo por jornada) y
   **habilidad requerida** (sirve para sugerir a quién programar).

## 3. Voluntarios

- **Buscar**: escriba cualquier parte del nombre o de la profesión («jose pint»). No importan tildes ni mayúsculas.
- **Filtros**: congregación o invitados, Local/A-2, disponible un día y jornada, rango de edad. El botón
  **⬇ Excel** exporta exactamente lo que se ve.
- En la **ficha**: llamar o escribir por WhatsApp a cada número, enviar un mensaje con plantilla, ver su
  contacto de emergencia y su congregación.
- **Emergencia** (botón rojo en Inicio y Asistencia): escriba el nombre y toque **Llamar** a su contacto.

### Carga masiva
1. **Descargar plantilla Excel**, llénela (borre las 3 filas de ejemplo).
2. Disponibilidad con códigos: `LU-M, MI-T, SA-D` (LU MA MI JU VI SA DO · M mañana, T tarde, D día completo).
3. Cargue el archivo **o** copie las celdas en Excel y péguelas en el cuadro de texto.
4. Revise la vista previa: rojo = error (no se importa), ámbar = posible duplicado. Puede crear las
   congregaciones que falten. Toque **Importar**.

## 4. Programación

1. Elija la **fecha** (‹ › saltan entre días de trabajo) y la **jornada**.
2. Escriba el **cupo** (obligatorio). Si falta, la app avisa «sin cupo».
3. **Agregar voluntarios**: elija la tarea (o «la habitual de cada uno»); arriba aparecen los disponibles
   ese día, primero los de esa tarea y los de la profesión que coincide (★). Puede agregar a alguien no
   disponible o pasar del cupo: la app solo avisa.
4. Marque cada uno como **Pendiente / Confirmado / No puede** («No puede» no ocupa cupo).
5. **Copiar a otra fecha** arma rápido el siguiente sábado.
6. Para avisar:
   - **✉ Envío guiado**: abre WhatsApp con cada persona, en orden, y marca a quién ya se le envió.
   - **Compartir texto**: la programación lista para pegar en un grupo de WhatsApp.
   - **Imagen / PDF**: la hoja para compartir o imprimir.

## 5. Asistencia (el día de trabajo)

1. Abra **Asistencia** (sale la fecha de hoy y la jornada según la hora).
2. **Toque a cada persona al llegar**: queda ✓ con la hora.
3. Si llegó alguien que no estaba programado: **Agregar no programado**.
4. Al final: **Salida general**.
5. El botón **⋯** de cada persona permite corregir horas, tarea realizada, observación o desmarcar.
6. Se pueden corregir días pasados cambiando la fecha.

## 6. Informes (Más → Exportar)

Elija el rango de fechas y descargue el **Informe completo** o cada hoja: horas y jornadas por voluntario,
por tarea, por fecha y listado de voluntarios. Las **horas** se calculan con el **horario de la jornada**
(día completo = mañana + tarde), no con la hora real de llegada y salida.

## 7. Nube y respaldo

### La nube
- Cada cambio se guarda primero en el dispositivo y se sube a la nube en segundos. Los demás dispositivos lo
  reciben al momento (o al abrir la app).
- **Sin internet** se puede trabajar normal (por ejemplo, la asistencia en la obra): los cambios quedan
  «por subir» y se suben solos al volver la señal.
- **Más → Nube** muestra el estado, la última sincronización y cuántos cambios faltan por subir.
- Si dos personas cambian **el mismo registro** a la vez, queda el último que se subió.
- La **primera vez** que un dispositivo con datos se conecta a una nube que ya tiene datos distintos, la app
  pregunta con cuáles quedarse. Lo normal es **Usar los datos de la nube**.
- **Ojo:** «Empezar de cero» y «Restaurar → Reemplazar todo» ahora afectan a **todos** los dispositivos.
- En Supabase queda un **historial** de cada cambio (tabla `registros_historial`), por si hay que recuperar
  algo borrado por error.

### Respaldo

- **Más → Respaldo → Crear respaldo y compartir**: guarde el archivo `voluntarios-respaldo-AAAA-MM-DD.json`
  en Drive, en un chat de WhatsApp con usted mismo o en el PC.
- Inicio muestra **«Haga un respaldo»** cuando hay cambios sin respaldar.
- **Restaurar**: elija el archivo, revise los conteos y toque **Reemplazar todo** (deja exactamente lo del
  archivo) o **Combinar** (agrega o actualiza; conserva lo demás).
- **Empezar de cero**: borra los datos en todos los dispositivos (por ejemplo, al terminar las pruebas).
  Pide escribir BORRAR.

> Aunque los datos estén en la nube, conviene un respaldo de vez en cuando: es la copia que nadie más puede
> tocar.

## 8. Cierre del proyecto

- [ ] Pasar la última asistencia y revisar días con personas sin marcar.
- [ ] **Exportar → Informe completo** con «Fechas del proyecto» y guardarlo.
- [ ] **Exportar → Listado de voluntarios** y guardarlo.
- [ ] **Crear respaldo final** y guardarlo en dos lugares.
- [ ] Si ya no se usará: **Respaldo → Empezar de cero** (marcar «Borrar también Ajustes…») y desinstalar la app.
