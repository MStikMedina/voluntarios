# PLAN — App «Voluntarios» (Remodelación del Salón del Reino)

## 0. Cómo usar este plan (protocolo de cada sesión)

Cuando el usuario diga **"comienza con la siguiente fase"**:
1. Leer este PLAN.md completo (sobre todo §2 Requisitos, §4 Modelo de datos y §8 Bitácora).
2. Buscar en §7 la **primera fase sin marcar `[ ]`**. Esa es la fase de la sesión. Hacer solo esa.
3. Revisar el código que ya existe en `app/` antes de escribir algo nuevo y reutilizar lo hecho.
4. Implementar la fase y cumplir sus **criterios de aceptación**.
5. Verificar: `npm run build` sin errores, `npm test` en verde y una prueba manual
   (`npm run dev`, vista móvil). Si la app ya está publicada, hacer el deploy y pedir al usuario
   que la pruebe en el celular.
6. Marcar la fase como `[x]` y escribir en §8 Bitácora: fecha, qué se hizo, decisiones nuevas,
   pendientes. Si una decisión cambia un requisito, actualizar §2.
7. Hacer commit con un mensaje claro (y push si ya hay remoto).

Reglas generales: todo en español, sin servidor ni base de datos externa, los datos solo
en el dispositivo. **Nunca** subir datos de voluntarios a GitHub (respaldos `*.json` y `*.xlsx`
en `.gitignore`).

---

## 1. Contexto

- El usuario coordina a los voluntarios de la remodelación de su Salón del Reino.
- La app es de **un solo uso** (dura lo que dure el proyecto) y la usa **una sola persona**.
- Se usa sobre todo en un **celular Android**. En el PC se usa la misma app web, pasando los datos
  con un archivo de respaldo.
- Hay unos **50 a 150 voluntarios** de **3 congregaciones**, más hermanos de otras congregaciones
  invitados para trabajos puntuales.
- Formulario base: `Registro de voluntarios.pdf` (en esta carpeta), al que se le agrega **Congregación**.
- El usuario tiene un nivel técnico avanzado, tiene Git y cuenta de GitHub, y acepta instalar Node.js.

## 2. Requisitos (decisiones del usuario)

### 2.1 Plataforma
- **PWA instalable** (ícono en el celular, funciona 100% sin internet), publicada en **GitHub Pages**
  (repositorio público, solo con el código).
- Datos en **IndexedDB** del navegador. Se pide `navigator.storage.persist()`.
- Se publica **desde la Fase 1** para probar cada fase en el celular.
- Tema **automático** (claro u oscuro según el celular), color principal **azul sobrio**,
  tamaño de letra **normal**, navegación con **barra inferior**.
- Nombre de la app: **"Voluntarios"**.
- Formatos: fecha **dd/mm/aaaa**, hora **12 h (a. m./p. m.)**, país **+57 Colombia**.

### 2.2 Proyecto (uno solo; se configura en Ajustes)
Nombre del proyecto, ciudad, dirección del Salón, fechas de inicio y fin, Superintendente o
Encargado (nombre y celular). También: **días de trabajo de la semana** (configurables), **horario
de las jornadas** Mañana y Tarde (configurable), **límites de edad** para las alertas (configurables,
por defecto menos de 18 y más de 65) y frecuencia del recordatorio de respaldo (**diario** por defecto; también **semanal**).

### 2.3 Congregación
- Nombre y número.
- Coordinador del cuerpo de ancianos y su celular (dato del PDF).
- Otro contacto: nombre y celular.
- No se puede borrar si tiene voluntarios (hay que reasignarlos antes).

### 2.4 Voluntario (solo los datos del PDF, más congregación y observaciones)
| Campo | Detalle |
|---|---|
| Nombre | **Un solo campo**. Se busca por cualquier palabra, sin importar tildes ni mayúsculas |
| Congregación | Del catálogo |
| Invitado puntual | Casilla. Si está marcada: **Motivo** y **Quién lo invitó** (texto libre) |
| Vol. local o A-2 | Solo dos opciones: `Local` o `A-2` |
| Fecha de nacimiento | Se muestra la **edad**, con alerta de **menor** y de **mayor** según Ajustes |
| Profesión o habilidad | **Texto libre**. Se busca por cualquier palabra |
| Contacto de emergencia | Nombre y celular |
| Celular | **Varios números**, uno marcado como **principal**. Se valida que tenga 10 dígitos (3xx xxx xxxx) |
| Días disponibles | **Semanal y recurrente**: por cada día de la semana, `—` / `M` (mañana) / `T` (tarde) / `D` (día completo) |
| Tarea habitual | Opcional (ver Tareas) |
| Observaciones | Texto libre |

- No hay campos extra (sin sexo, documento, foto ni datos teocráticos), no hay estado
  activo/inactivo y **no se controlan los documentos** DC-82 ni la Declaración médica.
- Si hay **duplicados** (nombre o celular igual), la app **avisa** sin bloquear, al guardar y al importar.
- Para eliminar se pide confirmación y luego se borra definitivamente.

### 2.5 Celulares, llamadas y WhatsApp
- **Todos** los celulares de la app (voluntario, contacto de emergencia, coordinador, otro contacto
  y superintendente) tienen botón de **Llamar** (`tel:+57…`) y de **WhatsApp**.
- WhatsApp debe abrir **siempre el WhatsApp normal (`com.whatsapp`)**, nunca Business ni el clon. Se usa
  un intent de Android:
  `intent://send/?phone=57XXXXXXXXXX&text=…#Intent;scheme=whatsapp;package=com.whatsapp;end`
  (en el PC, si eso falla, se usa `https://wa.me/57…`).
- **Plantillas** de mensaje editables, con variables `{nombre}`, `{fecha}`, `{jornada}`, `{hora}`,
  `{tarea}` y `{proyecto}`. Plantillas iniciales: Recordatorio de jornada, Confirmar asistencia,
  Agradecimiento y Mensaje libre.
- **Envío guiado uno por uno** (por ejemplo, a todos los programados de mañana): la app abre WhatsApp
  con cada persona en orden y marca a quién ya se le envió.

### 2.6 Lista y búsqueda
- La búsqueda rápida mira el **nombre** y la **profesión**, por cualquier palabra, sin importar
  tildes ni mayúsculas.
- Filtros: congregación o invitado, Local/A-2, disponible en un día y jornada, rango de edad.
- Orden **alfabético**. Cada tarjeta muestra nombre, congregación, profesión y botones de
  Llamar y WhatsApp.
- **Acceso de emergencia**: en 2 toques se busca al voluntario y se llama a su contacto de emergencia.
  Está visible en Inicio y en Asistencia.

### 2.7 Tareas o frentes
- Datos: nombre, descripción, fecha de inicio y fin, estado (pendiente, en curso o terminada),
  **personas necesarias** y **habilidad requerida** (texto).
- Asignación **mixta**: el voluntario puede tener una tarea habitual, y la programación de cada día
  puede cambiarla.
- Cupo por tarea: por defecto son las *personas necesarias*, y se puede **ajustar en una fecha concreta**.

### 2.8 Programación por día
- Se puede programar **cualquier fecha** (los días de trabajo de Ajustes solo marcan los días sugeridos).
- **Cupo general por fecha y jornada, obligatorio**: cada fecha tiene su propio número. Si no está
  definido, la app avisa "sin cupo".
- La app **sugiere los disponibles** según el día de la semana y la jornada, y pone primero a quienes
  tienen una profesión que coincide con la habilidad requerida de la tarea.
- Se puede programar a alguien **fuera de su disponibilidad** (la app avisa) y **pasarse del cupo**
  (también avisa).
- Cada programado tiene un estado de **confirmación**: pendiente, confirmado o no puede.
- **Compartir la programación** como texto para WhatsApp y como **PDF o imagen**. Incluye encabezado
  con el proyecto y la fecha, separa por jornada, agrupa por tarea y muestra los celulares.

### 2.9 Asistencia
- **Lista con toque**: con un toque queda marcado "llegó" y se guarda la hora actual.
- Por cada persona se registra: asistió sí/no, hora de llegada y de salida, tarea realizada
  y observación.
- Botón **"Salida general"**: marca la salida de todos los presentes.
- Se puede **agregar a alguien que no estaba programado**.
- Las **horas trabajadas** se calculan con el **horario configurado de la jornada**
  (D = mañana + tarde), no con las horas reales registradas.

### 2.10 Panel de inicio
Muestra la **asistencia de hoy** (programados frente a presentes por jornada), los **próximos 7 días**
(cupo definido o no, programados frente al cupo y faltantes), el botón de emergencia, el aviso de
respaldo pendiente y accesos rápidos.

### 2.11 Exportaciones (Excel .xlsx, sin gráficas en pantalla)
- Listado de voluntarios con **los filtros aplicados**, con todos los campos.
- Horas y jornadas por voluntario.
- Por tarea (jornadas y personas).
- Por fecha (cupo, programados, confirmados y asistentes por jornada).

### 2.12 Carga masiva
- **Plantilla Excel** que se puede descargar, con estas columnas: Nombre, Congregación, Local/A-2,
  Fecha nac. (dd/mm/aaaa), Profesión, Contacto emergencia, Cel. emergencia, Celular(es),
  Disponibilidad, Invitado, Motivo, Invitado por y Observaciones.
- Disponibilidad con **códigos cortos**: `LU-M, MA-T, SA-D` (LU MA MI JU VI SA DO; M/T/D).
- Se puede **importar Excel o CSV** y **pegar texto**, y la app **detecta sola el separador**
  (tabulación, punto y coma o coma).
- Antes de guardar se muestra una **vista previa** con validación por fila: errores, avisos de
  duplicados y congregaciones que no existen (con la opción de crearlas).

### 2.13 Respaldo
- Botón **"Crear respaldo"** que descarga un archivo `voluntarios-respaldo-AAAA-MM-DD.json`
  (en Android se usa el menú de compartir cuando está disponible).
- **Recordatorio diario** si hubo cambios después del último respaldo.
- Para **restaurar** se elige entre **reemplazar todo** (con confirmación) o **combinar** (agrega o
  actualiza según el id).
- El mismo archivo sirve para pasar los datos al PC y de vuelta.
- Sin PIN y sin cifrado.

## 3. Arquitectura técnica

- **Vite + React + TypeScript**, en la carpeta `app/` dentro de este proyecto.
- **Dexie.js** (IndexedDB) y `dexie-react-hooks` (`useLiveQuery`).
- **vite-plugin-pwa** (Workbox) para que funcione sin internet, con manifest, íconos y aviso de
  "nueva versión disponible".
- **React Router con HashRouter**, para que funcione bien en GitHub Pages.
- **Tailwind CSS** con modo oscuro según el sistema y color base azul (`#1e4e8c` aprox.).
- **SheetJS (`xlsx`)**, instalado desde el tarball oficial de cdn.sheetjs.com, para leer y escribir Excel.
- **html-to-image + jsPDF** para compartir la programación como imagen o PDF. Se usa la Web Share API
  para enviarla.
- **Vitest** para pruebas unitarias de la lógica: normalización, disponibilidad, cupos, horas
  e importación.
- Deploy: **GitHub Actions → GitHub Pages** en cada push a `main`. `base` de Vite = `/<nombre-repo>/`.

Estructura sugerida:
```
app/src/
  db/        (schema Dexie, tipos, repositorios)
  lib/       (texto.ts normalizar, fechas.ts, telefono.ts, whatsapp.ts, disponibilidad.ts,
              horas.ts, importar.ts, exportar.ts, respaldo.ts)
  components/(TelefonoAcciones, Tarjeta, Dialogo, BarraInferior, SelectorDisponibilidad…)
  pages/     (Inicio, Voluntarios, VoluntarioForm, VoluntarioFicha, Congregaciones, Tareas,
              Programacion, Asistencia, Mensajes, Exportar, Respaldo, Ajustes)
```
Barra inferior: **Inicio · Voluntarios · Programación · Asistencia · Más**.
En "Más" están Congregaciones, Tareas, Mensajes, Exportar, Carga masiva, Respaldo y Ajustes.

## 4. Modelo de datos (Dexie)

```ts
proyecto (registro único, id = 1): nombre, ciudad, direccion, fechaInicio, fechaFin,
  superintendenteNombre, superintendenteCelular, diasTrabajo: number[] (0=dom..6=sáb),
  jornadas: { M: {inicio:'07:00', fin:'12:00'}, T: {inicio:'13:00', fin:'17:00'} },
  edadMenor: 18, edadMayor: 65, frecuenciaRespaldo: 'diario'|'semanal',
  ultimoRespaldo?: string, ultimoCambio?: string

congregaciones: ++id, nombre, numero, coordinadorNombre, coordinadorCelular,
  otroContactoNombre, otroContactoCelular

voluntarios: ++id, nombre, nombreNorm*, congregacionId*, invitado, invitadoMotivo, invitadoPor,
  tipo: 'Local'|'A-2', fechaNacimiento ('YYYY-MM-DD'), profesion, profesionNorm,
  celulares: {numero:string, principal:boolean}[], emergenciaNombre, emergenciaCelular,
  disponibilidad: ('M'|'T'|'D'|null)[7] (índice 0=dom..6=sáb), tareaHabitualId?, observaciones, creado, actualizado

tareas: ++id, nombre, descripcion, fechaInicio, fechaFin, estado, personasNecesarias,
  habilidadRequerida

dias: fecha (PK 'YYYY-MM-DD'), cupoM?, cupoT?, cuposTarea: {[tareaId]: number}, notas

programaciones: ++id, [fecha+jornada]*, voluntarioId*, jornada:'M'|'T', tareaId?,
  confirmacion: 'pendiente'|'confirmado'|'no_puede', mensajeEnviado: boolean

asistencias: ++id, [fecha+jornada]*, voluntarioId*, asistio, horaLlegada?, horaSalida?,
  tareaId?, tareaTexto?, observacion

plantillas: ++id, nombre, texto
```
Si un voluntario tiene `D` en un día, se le cuenta como disponible en M y en T. Los campos `*Norm` se
guardan en minúsculas, sin tildes y sin espacios repetidos. Cada vez que se escribe algo se actualiza
`proyecto.ultimoCambio`, que sirve para el recordatorio de respaldo.

## 5. Utilidades clave (se crean una vez y se reutilizan en todas las fases)
- `normalizar(texto)` y `coincide(busqueda, ...campos)`: búsqueda por todas las palabras.
- `edad(fechaNac)`, `alertaEdad(edad, ajustes)`, `formatoFecha` (dd/mm/aaaa) y `formatoHora` (12 h).
- `validarCelular`, `telHref` y `whatsappHref(numero, texto)` con el intent de `com.whatsapp`.
- `disponibleEn(vol, fecha, jornada)`, `parsearCodigosDisponibilidad('LU-M, SA-D')` y su inversa.
- `horasDeJornada(jornada, ajustes)`.
- `rellenarPlantilla(texto, variables)`.
- Componente `<TelefonoAcciones numero>`, que se usa en **todos** los lugares donde aparece un celular.

## 6. Riesgos y mitigaciones
- **Pérdida de datos** si se borra el navegador: se pide `storage.persist()`, hay recordatorio diario
  de respaldo y el respaldo está disponible desde la Fase 7.
- **El intent de WhatsApp en una PWA**: se prueba en el celular real en la Fase 4. Plan B:
  `whatsapp://send?phone=` y luego `wa.me`.
- **GitHub Pages es público**: el código no contiene datos y `.gitignore` excluye `*.json` de respaldo
  y `*.xlsx`.
- Actualizaciones de la PWA: aviso de "Nueva versión, recargar" con `registerType: 'prompt'`.

## 7. Fases (1 sesión = 1 fase)

- [x] **Fase 0 — Planificación.** 104 preguntas respondidas y creación de este PLAN.md.

- [x] **Fase 1 — Entorno, esqueleto y publicación**
  - Verificar o instalar Node.js LTS. Crear `app/` con Vite + React + TS, Tailwind, React Router
    (HashRouter) y vite-plugin-pwa (manifest "Voluntarios", íconos azules, modo sin internet).
  - Layout con la barra inferior y las 5 secciones vacías. Tema automático claro u oscuro.
  - `git init`, `.gitignore` (node_modules, dist, *.json de respaldo, *.xlsx), repo en GitHub,
    workflow de GitHub Actions para Pages.
  - ✅ Aceptación: la URL de Pages abre en el celular, **se instala** con ícono y abre sin internet.

- [x] **Fase 2 — Capa de datos y utilidades**
  - Schema Dexie (§4), tipos TS, `storage.persist()`, utilidades de §5 (menos WhatsApp), Vitest
    con pruebas de normalizar, edad, fechas, disponibilidad y horas.
  - ✅ Aceptación: pruebas en verde y datos de prueba que siguen ahí al recargar.

- [x] **Fase 3 — Ajustes del proyecto**
  - Pantalla de Ajustes con los datos del proyecto (§2.2), días de trabajo, horarios M/T, límites de
    edad y frecuencia del respaldo.
  - ✅ Aceptación: se guarda, se carga y valida (por ejemplo, que la fecha de fin no quede antes que la de inicio).

- [x] **Fase 4 — Congregaciones + llamar/WhatsApp**
  - CRUD de congregaciones (§2.3) que impide borrar si tiene voluntarios.
  - Componente `<TelefonoAcciones>` con llamada y WhatsApp normal (intent `com.whatsapp`).
    **Probar en el celular** que abre el WhatsApp personal.
  - ✅ Aceptación: se crean las 3 congregaciones reales y WhatsApp abre el normal.

- [x] **Fase 5 — Voluntarios: formulario y ficha**
  - Formulario completo (§2.4): varios celulares con uno principal, selector de disponibilidad
    semanal M/T/D, invitado con motivo y quién lo invitó, validación de 10 dígitos y aviso de duplicados.
  - Ficha con la edad, alertas de menor/mayor, todos los teléfonos con sus botones, editar y eliminar.
  - ✅ Aceptación: se crean, editan y eliminan voluntarios desde el celular.

- [x] **Fase 6 — Lista, búsqueda, filtros y emergencia**
  - Lista alfabética con tarjetas (§2.6), búsqueda tolerante por nombre y profesión, filtros
    (congregación/invitado, Local/A-2, día+jornada, rango de edad).
  - Acceso de emergencia en 2 toques.
  - ✅ Aceptación: "jose pint" encuentra "José … / Pintor"; los filtros se combinan bien.

- [x] **Fase 7 — Respaldo y restauración**
  - Crear el respaldo JSON (descargar o compartir), restaurar reemplazando o combinando con vista
    previa de conteos, y recordatorio diario en Inicio.
  - ✅ Aceptación: respaldo en el celular → restaurar en el PC → datos idénticos.

- [x] **Fase 8 — Carga masiva**
  - Descargar la plantilla Excel, importar Excel/CSV, pegar texto con detección del separador,
    leer los códigos de disponibilidad, vista previa con validación y duplicados, y crear las
    congregaciones que falten.
  - ✅ Aceptación: se importan 20 filas de prueba sin errores y las filas inválidas quedan señaladas.

- [ ] **Fase 9 — Tareas**
  - CRUD de tareas (§2.7), estados y tarea habitual en el voluntario.
  - ✅ Aceptación: se crean tareas y se asigna una tarea habitual.

- [ ] **Fase 10 — Programación por día**
  - Selector de fecha, cupo obligatorio por fecha y jornada, ajuste del cupo por tarea en esa fecha.
  - Lista de sugeridos (disponibles, con prioridad a la habilidad), programar con tarea (por defecto
    la habitual), avisos de fuera de disponibilidad y de cupo superado (general y por tarea), y estado
    de confirmación.
  - ✅ Aceptación: se programa una semana de prueba con contadores correctos.

- [ ] **Fase 11 — Mensajes de WhatsApp**
  - CRUD de plantillas con variables y las 4 plantillas iniciales, envío individual desde la ficha,
    **envío guiado** a los programados de una fecha y jornada (marcando a quién ya se envió), y
    compartir la programación del día como texto.
  - ✅ Aceptación: el envío guiado recorre a todos y el texto llega bien formateado.

- [ ] **Fase 12 — Programación como PDF o imagen**
  - Vista imprimible (encabezado, jornadas, agrupado por tarea, celulares) → PNG y PDF → compartir.
  - ✅ Aceptación: se genera y se comparte por WhatsApp desde el celular.

- [ ] **Fase 13 — Asistencia**
  - Lista de programados de hoy por jornada con marca de un toque (hora de llegada), salida individual
    y "Salida general", agregar a alguien no programado, tarea realizada y observación, y editar días pasados.
  - ✅ Aceptación: se pasa asistencia completa de una jornada en menos de 1 minuto.

- [ ] **Fase 14 — Panel de inicio**
  - Asistencia de hoy, próximos 7 días (cupo definido o no, programados frente al cupo, faltantes),
    emergencia, aviso de respaldo y accesos rápidos.
  - ✅ Aceptación: los números coinciden con Programación y Asistencia.

- [ ] **Fase 15 — Exportaciones a Excel**
  - Listado filtrado de voluntarios, horas y jornadas por voluntario (según el horario de la jornada),
    por tarea y por fecha (§2.11).
  - ✅ Aceptación: los archivos abren en Excel con totales correctos.

- [ ] **Fase 16 — Pulido final y cierre**
  - Prueba de punta a punta en el celular, revisión del modo oscuro, rendimiento con 150 voluntarios,
    estados vacíos y mensajes de error, y una guía de uso corta (`GUIA.md`).
  - Checklist de cierre del proyecto: respaldo final y exportaciones finales.
  - ✅ Aceptación: el usuario aprueba la app para usarla en la obra.

## 8. Bitácora
| Fecha | Fase | Notas |
|---|---|---|
| 23/11/2026 | 0 | Planificación completa. 104 preguntas. Decisiones en §2. |
| 23/11/2026 | 1 (parcial) | Node v26.13.1 portable en `%LOCALAPPDATA%\Programs\nodejs` y GitHub CLI en `%LOCALAPPDATA%\Programs\gh\bin` (sin winget; ambos agregados al PATH del usuario, abrir una terminal nueva). App en `app/`: Vite 8 + React 19 + TS, Tailwind 4 (`@tailwindcss/vite`, colores `primario-*` en `index.css`), React Router 7 con HashRouter, vite-plugin-pwa 2 (`registerType: 'prompt'`, aviso "Recargar" en `AvisoActualizacion`). Íconos generados desde `public/icono.svg` con `npm run iconos`. Layout con barra inferior de 5 secciones y menú "Más" (`pages/secciones.ts`) con páginas "llega en la Fase N". `BASE` de Vite se pasa por variable de entorno (el workflow usa el nombre del repo). **Vitest**: por la tilde de "Construcción" en la ruta, `import … from 'vitest'` falla; se usa `globals: true` en `vitest.config.ts` y las pruebas NO importan de vitest. `.gitignore` en la raíz excluye `*.json` (salvo los de config de `app/`), `*.xlsx`, `*.xls`, `*.csv` y `*.pdf`. Build, test y lint en verde; revisado en claro y oscuro. Repo público **MStikMedina/voluntarios**, Pages con build por Actions, publicado en **https://mstikmedina.github.io/voluntarios/** (workflow en verde). Git local con autor noreply (`137585725+MStikMedina@users.noreply.github.com`). El usuario confirmó en el celular: se instala, abre sin internet y sigue el tema. **Fase 1 completa.** |
| 23/11/2026 | 2 | Dexie 4 + dexie-react-hooks; `fake-indexeddb` (dev) para probar la BD en Vitest. **`db/`**: `tipos.ts` (modelo §4), `db.ts` (clase `BaseVoluntarios`, instancia `db`, schema v1, `populate` crea el proyecto por defecto y las 4 plantillas iniciales de §2.5), `persistencia.ts` (`storage.persist()`, se llama en `main.tsx`), `datosPrueba.ts`. **Middleware DBCore** en `db.ts`: en toda escritura de voluntarios calcula `nombreNorm`/`profesionNorm` (no hay que hacerlo a mano) y en cualquier tabla salvo `proyecto` marca `proyecto.ultimoCambio` (con `setTimeout`, fuera de la transacción; no cuenta la creación de la base). El proyecto se lee con `db.obtenerProyecto()` y se guarda con `db.guardarProyecto(cambios)` (marca `ultimoCambio`, salvo si solo cambia `ultimoRespaldo`). Decisiones: `disponibilidad` es un **arreglo de 7** (índice 0 = domingo) con `'M'|'T'|'D'|null`; al leer códigos, M + T del mismo día = D; campo nuevo `proyecto.frecuenciaRespaldo: 'diario'`; días de trabajo por defecto = sábado; celular válido = 10 dígitos que empiezan por 3 (se acepta y quita el +57). **`lib/`**: `texto.ts`, `fechas.ts` (fechas `'YYYY-MM-DD'` en hora local, edad, alertas, 12 h), `telefono.ts`, `disponibilidad.ts`, `horas.ts`, `plantillas.ts`. WhatsApp queda para la Fase 4. Tarjeta **"Datos en este dispositivo"** al final de "Más" (conteos, último cambio, estado de protección y botones Crear/Borrar datos de prueba en la congregación "(Prueba)"). 19 pruebas en verde; probado en Chrome headless por DevTools Protocol: crear datos → recargar → siguen ahí → borrar, en claro y oscuro. En Chrome de escritorio sin instalar, la protección sale "sin protección permanente" (normal; en la PWA instalada debería quedar protegida). **Pendiente:** que el usuario lo pruebe en el celular. **Fase 2 completa.** |
| 23/11/2026 | 3 | Pantalla **Ajustes** en `pages/Ajustes.tsx` (ruta `#/mas/ajustes`), con tarjetas: Proyecto, Superintendente o encargado, Días de trabajo (botones Lu…Do, lunes primero), Horario de las jornadas (inputs `time`, muestra horas en 12 h y total M/T/D con `horasDeJornada`), Alertas de edad y Respaldo. Barra fija de **Guardar/Descartar** sobre la barra inferior con estado (Sin cambios / Cambios sin guardar / ✓ Guardado / Revise los campos en rojo). Lógica pura en `lib/ajustes.ts`: `proyectoAForm`, `formAProyecto` (recorta textos, celular solo dígitos, días ordenados sin repetir), `validarAjustes` y `hayCambios`. **Validaciones:** nombre obligatorio; fechas opcionales pero válidas y fin ≥ inicio; celular del superintendente opcional pero válido; al menos un día de trabajo; cada jornada con fin > inicio y la tarde no empieza antes de que termine la mañana; edades enteras 1–120 y menor < mayor. Los errores se muestran al intentar guardar (el de fecha de fin, en vivo) y se hace scroll al primero. **Decisión nueva:** `frecuenciaRespaldo` ahora es `'diario' | 'semanal'` (tipo `FrecuenciaRespaldo`; por defecto diario); el recordatorio se implementa en la Fase 7. Componentes reutilizables nuevos: `components/Campos.tsx` (`Tarjeta`, `Campo`, `MensajeError`, `claseInput`) y `Pagina` acepta `volver` (enlace "← Más"). 10 pruebas nuevas (29 en total) en verde; build y lint limpios; probado en Chrome headless 412 px: errores → corregir → guardar → recargar → datos iguales, en oscuro. **Pendiente:** que el usuario lo pruebe en el celular. **Fase 3 completa.** |
| 23/11/2026 | 4 | **Congregaciones** en `pages/Congregaciones.tsx` (`#/mas/congregaciones`: lista alfabética sin importar tildes, con número, cantidad de voluntarios y botones del coordinador y del otro contacto) y `pages/CongregacionForm.tsx` (`#/mas/congregaciones/nueva` y `/:id`). Validación: nombre obligatorio, número solo dígitos (opcional), celulares opcionales pero válidos (se formatean al salir del campo). **Aviso de duplicados** por nombre (normalizado) o número, sin bloquear. **Borrado seguro**: si tiene voluntarios no se puede eliminar; en la misma pantalla se ofrece **"Pasarlos a…"** otra congregación (con confirmación) y luego se elimina (con confirmación). Lógica en `lib/congregaciones.ts` (`validarCongregacion`, `formACongregacion`, `duplicadosCongregacion`, `eliminarCongregacion` que lanza `CongregacionConVoluntarios`, `reasignarVoluntarios`). **WhatsApp** en `lib/whatsapp.ts`: en Android `intent://send/?phone=57…&text=…#Intent;scheme=whatsapp;package=com.whatsapp;S.browser_fallback_url=<wa.me>;end` (si el WhatsApp normal no está instalado, Chrome abre wa.me); en el PC `https://wa.me/57…` en otra pestaña. Componente **`<TelefonoAcciones numero etiqueta texto compacto>`** (botones redondos Llamar azul y WhatsApp verde; si el número no es válido lo muestra sin botones); ya se usa en Congregaciones y en Ajustes (superintendente). Componentes nuevos: `Dialogo` (`<dialog>` nativo + clases de botón primario/secundario/peligro) e íconos Teléfono, WhatsApp (genérico), Más y Basura. 9 pruebas nuevas (38 en total) en verde; build y lint limpios; probado en Chrome headless 412 px con UA Android, en claro y oscuro: error de celular → corregir → guardar → duplicado → reasignar → eliminar → recargar. **Pendiente (aceptación):** que el usuario cree las 3 congregaciones reales en el celular y confirme que el botón de WhatsApp abre el **WhatsApp normal** (si no, plan B de §6: `whatsapp://send?phone=`). **Fase 4 completa** salvo esa confirmación. |
| 23/11/2026 | 5 | **Formulario** en `pages/VoluntarioForm.tsx` (`#/voluntarios/nuevo` y `#/voluntarios/:id/editar`) con tarjetas Datos personales, Celulares, Contacto de emergencia, Días disponibles y Observaciones. **Ficha** en `pages/VoluntarioFicha.tsx` (`#/voluntarios/:id`): insignias (congregación, Local/A-2, invitado, edad con alerta), botón Editar, todos los celulares (principal primero) y el de emergencia con `<TelefonoAcciones>`, datos, disponibilidad, contactos de su congregación y Eliminar con confirmación. **Lista básica** en `pages/Voluntarios.tsx` (alfabética, botón Nuevo, tarjeta con congregación · profesión, alerta de edad y botones del celular principal); la búsqueda y los filtros quedan para la Fase 6. Lógica en `lib/voluntarios.ts` (`formVoluntarioVacio`, `voluntarioAForm`, `formAVoluntario`, `validarVoluntario`, `asegurarPrincipal`, `celularPrincipal`, `duplicadosVoluntario`, `guardarVoluntario`, `eliminarVoluntario`, `ordenarVoluntarios`). Componentes nuevos: `SelectorDisponibilidad` (7 filas lunes→domingo con —/M/T/D, marca los días de trabajo con •; sin `onCambiar` se muestra como lectura), `Edad` (insignia ámbar menor / morada mayor; `soloAlerta` para tarjetas) y `Aviso` (movido a `Campos.tsx`, también lo usa Congregaciones). **Decisiones:** congregación obligatoria salvo para invitados (pueden quedar «Otra / sin congregación»); si solo hay una congregación se elige sola al crear; celulares: filas vacías y repetidos se descartan al guardar y siempre queda exactamente un principal; fecha de nacimiento con `input type=date`, no futura ni de más de 110 años; motivo/invitado por se borran si se desmarca «Invitado»; duplicados (nombre normalizado o cualquier celular) se avisan en vivo y al guardar con un diálogo «Revisar / Guardar igual»; **eliminar** un voluntario borra también su programación y su asistencia; al guardar se va a la ficha. La tarea habitual se agrega al formulario en la Fase 9 (el campo ya se conserva al editar). 9 pruebas nuevas (47 en total) en verde; build y lint limpios; probado en Chrome headless 412 px con UA Android: errores → corregir → guardar → ficha → duplicado → guardar igual → editar → eliminar → recargar, en oscuro. **Pendiente (aceptación):** que el usuario cree, edite y elimine voluntarios desde el celular. **Fase 5 completa** salvo esa confirmación. |
| 23/11/2026 | 6 | El usuario confirmó en el celular la Fase 5 (crear, editar y eliminar) y que **WhatsApp abre el normal** (cierra la aceptación pendiente de la Fase 4). **Lista** en `pages/Voluntarios.tsx`: buscador (nombre y profesión, todas las palabras, sin tildes ni mayúsculas, usando `nombreNorm`/`profesionNorm`), botón **Filtros** con contador y panel: Congregación (Todas / cada una / Invitados puntuales / Sin congregación), Local/A-2, Disponible (día de la semana + jornada: cualquiera, Mañana, Tarde o Día completo; D cubre M y T, «Día completo» exige D; jornada sin día = algún día de la semana), Edad desde/hasta con atajos «Menores de N» y «Mayores de N» (límites de Ajustes; quien no tiene fecha de nacimiento queda fuera). Los filtros puestos se ven como **chips** con × y «Quitar todos»; contador «N de M voluntarios»; estado vacío con «Limpiar búsqueda y filtros». **Decisión:** la búsqueda y los filtros viven en la **URL** (`?q=&c=&t=&d=&j=&emin=&emax=`) y la última se recuerda en memoria (`rutaListaVoluntarios()`), así «← Voluntarios» desde la ficha o el formulario vuelve con los mismos filtros. Lógica pura en `lib/filtros.ts` (`cumpleFiltros`, `filtrarVoluntarios`, `filtrosActivos`, `filtrosDeParams`/`filtrosAParams`). **Emergencia**: `components/BotonEmergencia.tsx` (botón rojo en Inicio y Asistencia) → `pages/Emergencia.tsx` (`#/emergencia`, buscador con foco automático por nombre; cada resultado muestra el contacto de emergencia con Llamar/WhatsApp; si no tiene, avisa y ofrece el coordinador de su congregación; «←» vuelve a la pantalla de origen). Íconos nuevos: Buscar, Filtro, Cerrar, Emergencia. 7 pruebas nuevas (54 en total) en verde; build y lint limpios; probado en Chrome headless 412 px con UA Android: «jose pint» → José Pérez / Pintor; filtros combinados (Sábado·Tarde + 35 años o más); ficha → volver conserva filtros; emergencia desde Asistencia llama a `tel:+57…` del contacto. **Pendiente (aceptación):** que el usuario lo pruebe en el celular. **Fase 6 completa** salvo esa confirmación. |
| 23/11/2026 | 7 | El usuario confirmó la Fase 6 en el celular. **Respaldo** en `pages/Respaldo.tsx` (`#/mas/respaldo`): «Crear respaldo y compartir» (Web Share API con archivo; si no se puede o falla, descarga) y «Solo descargar el archivo»; muestra último respaldo, último cambio y aviso de cambios sin respaldar. **Restaurar**: se elige el `.json`, se valida y se muestra una **vista previa** con conteos por tabla (archivo frente a este equipo), luego «Reemplazar todo» (borra y deja exactamente lo del archivo) o «Combinar» (bulkPut por id; lo que solo está en el equipo se conserva), ambos con confirmación. Lógica en `lib/respaldo.ts` (`crearRespaldo`, `leerRespaldo` con mensajes claros para archivo ajeno/dañado/versión nueva, `restaurarRespaldo`, `contar`/`contarBase`, `respaldoPendiente`, `cambiosSinRespaldar`, `nombreArchivoRespaldo`) y `lib/descargas.ts` (`entregarArchivo` compartir-o-descargar, `descargarBlob`, `compartirTexto`, `copiarTexto`; se reutiliza para Excel, PNG y PDF). **Recordatorio** `components/AvisoRespaldo.tsx` en Inicio: aparece si hubo cambios después del último respaldo y pasó ≥1 día calendario (diario) o ≥7 (semanal); sin respaldo previo aparece con el primer cambio. **Decisiones:** el formato es `{app:'voluntarios', version:1, creado, datos:{proyecto, …7 tablas}}`; al restaurar, el proyecto viene del archivo pero `ultimoRespaldo` se conserva del equipo; tras «Reemplazar» no queda respaldo pendiente (los datos son idénticos al archivo); tablas ausentes se toman como vacías. `fechaHora()` pasó a `lib/fechas.ts`. 5 pruebas nuevas (59) en verde, incluida respaldo → JSON → restaurar en otra base = datos idénticos; build y lint limpios; probado en Chrome headless: aviso en Inicio → respaldo → borrar datos → restaurar con vista previa → 3 voluntarios de vuelta. **Pendiente (aceptación):** respaldo en el celular → restaurar en el PC. |
| 23/11/2026 | 8 | **Carga masiva** en `pages/CargaMasiva.tsx` (`#/mas/carga-masiva`): 1) «Descargar plantilla Excel» (hoja Voluntarios con las 13 columnas de §2.12 + 3 ejemplos, y hoja Instrucciones con las reglas y las congregaciones existentes); 2) importar archivo `.xlsx/.xls/.ods/.csv/.txt` o **pegar texto**, con **detección del separador** (tabulación, punto y coma o coma; respeta comillas y saltos de línea entre comillas); 3) **vista previa** con resumen (filas / con avisos / con errores), lista coloreada por fila (verde ok, ámbar aviso, rojo error) con el motivo, filtro «solo filas con problemas», congregaciones que no existen con la casilla «Crearlas al importar» (si se desmarca, esas filas se omiten) y botón «Importar N voluntarios». SheetJS 0.20.3 instalado desde el tarball oficial de cdn.sheetjs.com y cargado con **import dinámico** (chunk aparte, también precacheado para uso sin internet). Lógica en `lib/importar.ts` (`detectarSeparador`, `parsearTexto`, `mapearColumnas` por encabezado con alias y en cualquier orden —sin encabezado se usa el orden de la plantilla—, `analizarFilas`, `congregacionesFaltantes`, `importarFilas`, `filasPlantilla`) y `lib/excel.ts` (`libroABlob`, `leerPrimeraHoja`, `celdaATexto` que convierte fechas de Excel a ISO; se reutiliza en Exportar). **Decisiones:** congregación se reconoce por nombre (sin tildes/mayúsculas) o por número; vacía solo si Invitado = Sí; Local/A-2 vacío = Local; fecha acepta dd/mm/aaaa o celda fecha de Excel; varios celulares separados por `/ , ; |` o «y», el primero es el principal; errores por fila: nombre, congregación, tipo, fecha, celulares, celular de emergencia y códigos de disponibilidad; avisos de duplicados con la app y dentro del mismo archivo (no bloquean). 14 pruebas nuevas (73) en verde; build y lint limpios; probado en Chrome headless: plantilla descargada → reimportada (3 filas sin errores), texto con `;` de 22 filas → 20 importadas, 2 señaladas con sus motivos, 2 congregaciones creadas. **Pendiente (aceptación):** que el usuario lo pruebe con un archivo suyo. |
