# Instrucciones de desarrollo - FRONTEND PRISMO

## 1. Responsabilidad

Eres el asistente de desarrollo encargado exclusivamente del frontend de PRISMO.

Debes construir la interfaz web de ALMA, el chatbot de Red Alumni y Coordinación de Empleabilidad de UNIFRANZ.

El avatar visual será Prismo de Adventure Time, usando una imagen proporcionada por el equipo, con un pin de UNIFRANZ y una animación sencilla de boca.

Tu trabajo está dentro de `frontend/`. No modifiques archivos de `backend/`.

## 2. Tecnologías obligatorias

- React.
- TypeScript.
- Vite.
- CSS.
- Fetch API.
- Web Speech API del navegador.

Usar componentes funcionales y hooks de React.

No utilizar Create React App, Next.js ni D-ID.

No instalar bibliotecas de animación, iconos o UI sin explicar antes qué problema resuelven y solicitar aprobación.

## 3. Objetivo de la interfaz

Construir una página profesional, amigable y responsive.

Debe incluir:

1. Encabezado con identidad de Red Alumni / UNIFRANZ.
2. Presentación de ALMA.
3. Avatar de Prismo.
4. Panel de conversación.
5. Mensajes del usuario y del asistente.
6. Campo para escribir preguntas.
7. Botón para enviar.
8. Botón para activar el micrófono.
9. Indicadores de carga, escucha y reproducción de voz.
10. Accesos o preguntas sugeridas para Estudiante, Alumni y Empresa.

La interfaz debe estar en español.

Mantener una apariencia institucional limpia, moderna y accesible. No inventar logotipos oficiales ni colores de marca no proporcionados por el equipo.

## 4. Estructura propuesta

Antes de crear los archivos, inspeccionar el proyecto y presentar una estructura similar a esta:

src/
components/
Avatar/
Chat/
VoiceControls/
ProfileSelector/
services/
chatApi.ts
hooks/
types/
styles/
App.tsx
main.tsx

La estructura puede ajustarse si existe una alternativa más sencilla y justificada.

Cada componente debe tener una responsabilidad clara.

## 5. Avatar de Prismo

El recurso principal estará en:

`public/assets/prismo.png`

La boca y el pin deben poder manejarse como elementos independientes si la imagen base lo permite.

Recursos previstos:

- `prismo.png`: imagen principal.
- `prismo-mouth.svg`: boca superpuesta y animable.
- `unifranz-pin.svg`: pin institucional superpuesto.

Reglas:

- Utilizar únicamente las imágenes proporcionadas por el equipo.
- No descargar imágenes de personajes desde Internet.
- No inventar ni dibujar un logotipo oficial.
- Si falta una imagen, usar un placeholder temporal y solicitar el archivo.
- No modificar ni reemplazar la imagen original.
- Diseñar el componente de modo que el estado `isSpeaking` active la animación de la boca.
- El pin debe poder cambiarse de posición mediante CSS.

Si la imagen proporcionada no permite separar la boca, explicar la limitación y proponer usar una segunda imagen con la boca abierta.

La animación será visual y aproximada: no debe presentarse como sincronización labial real.

## 6. Comunicación con el backend

Crear un servicio independiente en `services/chatApi.ts`.

Consumir:

`POST /api/chat`

La solicitud debe respetar este formato:

{
"message": "Pregunta actual",
"history": [
{
"role": "user",
"content": "Mensaje anterior"
},
{
"role": "assistant",
"content": "Respuesta anterior"
}
]
}

La respuesta exitosa tendrá este formato:

{
"reply": "Respuesta de ALMA"
}

Utilizar `fetch()`.

La URL base debe configurarse mediante:

`VITE_API_BASE_URL`

Durante el desarrollo puede utilizarse `http://localhost:3000` como valor local predeterminado.

Nunca incluir una API key de OpenAI en el frontend.

Mostrar errores comprensibles si el backend no está disponible o devuelve un error.

## 7. Reconocimiento de voz

Utilizar Web Speech API.

Implementar reconocimiento de voz con detección de disponibilidad de:

- `SpeechRecognition`.
- `webkitSpeechRecognition`.

El idioma debe configurarse para español, intentando `es-BO` y permitiendo ajustar el idioma si el navegador no lo soporta.

El reconocimiento debe:

- Iniciarse al pulsar el botón del micrófono.
- Capturar el texto reconocido.
- Mostrarlo en la interfaz.
- Permitir enviarlo al backend.
- Indicar cuando el usuario está hablando.
- Gestionar permisos denegados y errores.

Si el navegador no ofrece reconocimiento de voz, el chat escrito debe seguir funcionando normalmente.

## 8. Síntesis de voz

Utilizar `window.speechSynthesis` y `SpeechSynthesisUtterance`.

La respuesta de ALMA debe poder reproducirse en español.

Implementar estados para:

- Comienzo de la reproducción.
- Finalización.
- Error.
- Cancelación de voz.

Activar el estado `isSpeaking` durante la reproducción para controlar la animación de la boca.

Seleccionar una voz en español cuando esté disponible, con una alternativa predeterminada.

## 9. Estado de React

Gestionar de manera clara:

- Mensajes de conversación.
- Texto introducido.
- Estado de carga.
- Estado de escucha.
- Estado de reproducción.
- Errores.
- Perfil seleccionado.

Evitar componentes innecesariamente grandes.

No utilizar almacenamiento persistente o bases de datos para el historial en esta primera versión.

## 10. Pruebas

Ejecutar:

`npm run dev`

Y verificar la interfaz en el navegador.

Después de los cambios:

`npm run build`

Probar por etapas:

1. Interfaz sin backend.
2. Envío de texto con respuesta del backend.
3. Reconocimiento de voz.
4. Síntesis de voz.
5. Animación de boca.
6. Integración completa.

## 11. Forma de trabajo

No construir toda la aplicación de golpe.

Primero inspeccionar el proyecto, explicar la estructura actual y proponer los componentes.

Esperar aprobación antes de modificar archivos o instalar dependencias.

Después implementar una etapa por vez y explicar el código para que el desarrollador pueda entenderlo y defenderlo.
