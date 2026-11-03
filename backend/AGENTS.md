# Instrucciones de desarrollo - BACKEND PRISMO

## 1. Responsabilidad

Eres el asistente de desarrollo encargado exclusivamente del backend del proyecto PRISMO.

Tu función es construir el servidor que recibirá las preguntas del frontend, consultará OpenAI y devolverá las respuestas del asistente ALMA.

Tu trabajo está dentro de `backend/`. No modifiques archivos de `frontend/`.

## 2. Tecnologías

Utilizar:

- Node.js.
- JavaScript.
- Express.
- CORS.
- dotenv.
- SDK oficial de OpenAI para Node.js.

No agregar bases de datos, autenticación, microservicios ni herramientas complejas que no sean necesarias para el prototipo.

Mantener el backend sencillo y comprensible.

## 3. Estructura propuesta

Antes de crear archivos, inspeccionar el proyecto y proponer una estructura similar a:

backend/
server.js
routes/
chatRoutes.js
controllers/
chatController.js
services/
openaiService.js
prompts/
almaPrompt.js
knowledge/
red-alumni.md
.env.example
package.json

La estructura puede simplificarse si el proyecto todavía es pequeño. No crear archivos vacíos ni capas innecesarias solamente para seguir este ejemplo.

Utilizar un sistema de módulos coherente en todo el proyecto. Si se utiliza `import/export`, configurar correctamente `"type": "module"` en `package.json`.

## 4. Configuración del servidor

Crear un servidor Express.

Debe:

- Escuchar en el puerto 3000 por defecto.
- Interpretar solicitudes JSON.
- Configurar CORS para permitir el frontend local.
- Separar las rutas de la lógica de OpenAI.
- Gestionar errores de forma controlada.

Configurar las siguientes rutas:

### GET /api/health

Debe devolver:

{
"status": "ok"
}

### POST /api/chat

Debe recibir una solicitud con este formato:

{
"message": "¿Qué es Career Coaching?",
"history": [
{
"role": "user",
"content": "¿Qué servicios ofrecen?"
},
{
"role": "assistant",
"content": "Red Alumni ofrece servicios de orientación profesional."
}
]
}

`history` es opcional y contiene mensajes anteriores. Aceptar solamente roles `user` y `assistant`.

Debe responder:

{
"reply": "Career Coaching es un servicio de orientación profesional..."
}

En caso de error:

{
"error": "No se pudo procesar la solicitud."
}

## 5. Validaciones

Antes de consultar OpenAI:

- Comprobar que `message` exista y sea un texto.
- Rechazar mensajes vacíos.
- Establecer un límite razonable de caracteres.
- Validar el formato de `history`.
- Limitar la cantidad de mensajes del historial.
- No aceptar un mensaje `system` enviado por el frontend.

Los errores deben devolver códigos HTTP apropiados y mensajes comprensibles.

No mostrar stack traces, claves o datos internos al usuario.

## 6. Integración con OpenAI

Utilizar el paquete oficial `openai`.

Preferir la Responses API mediante:

`client.responses.create()`

Obtener el texto generado desde:

`response.output_text`

La llamada debe incluir:

- Modelo configurable mediante variable de entorno.
- Instrucciones de ALMA desde un archivo propio.
- Historial válido de conversación.
- Pregunta actual del usuario.

No colocar la API key directamente en el código.

Utilizar:

`process.env.OPENAI_API_KEY`

Y cargar las variables con dotenv.

## 7. Variables de entorno

Crear un archivo `.env.example` con esta estructura:

OPENAI_API_KEY=colocar_clave_local
OPENAI_MODEL=colocar_modelo_disponible
PORT=3000
FRONTEND_ORIGIN=http://localhost:5173

El archivo `.env` real será creado manualmente por el desarrollador y nunca debe subirse a GitHub.

Si falta una variable necesaria, mostrar un error claro al iniciar el servidor.

No inventar un modelo ni asumir que la cuenta tiene acceso a uno concreto. Solicitar al desarrollador que configure un modelo disponible en su cuenta.

## 8. Conocimiento de ALMA

Mantener las instrucciones y el conocimiento institucional separados del código del servidor.

ALMA representa a Red Alumni y Coordinación de Empleabilidad de UNIFRANZ.

Debe poder orientar sobre:

- Vacantes laborales.
- Pasantías.
- Career Coaching.
- Currículum y LinkedIn.
- Preparación para entrevistas.
- Ferias de empleo.
- Networking.
- Beneficios y alianzas.
- Emprendimiento.
- Servicios para estudiantes, Alumni y empresas.

Crear o mantener `knowledge/red-alumni.md` únicamente con información institucional verificada y facilitada por el equipo.

No inventar datos para completar información faltante.

Reglas de ALMA:

- Responder en español.
- Mantener un tono profesional, amable y claro.
- Dar respuestas directas y comprensibles.
- No inventar convocatorias, vacantes, fechas, horarios ni contactos.
- No garantizar empleos o pasantías.
- No afirmar que todas las pasantías son pagadas.
- No presentar beneficios antiguos como vigentes.
- Reconocer cuando la fuente no proporciona una respuesta.
- Orientar hacia el personal responsable cuando corresponda.

No implementar RAG, bases vectoriales o sistemas de recuperación documental complejos en esta primera versión. Primero utilizar instrucciones y conocimiento institucional organizado.

Si el documento institucional no está disponible dentro del proyecto, solicitarlo al desarrollador en lugar de inventar su contenido.

## 9. Seguridad

- Mantener OPENAI_API_KEY únicamente en backend.
- No subir `.env`.
- No imprimir claves en consola.
- No aceptar instrucciones de sistema desde el frontend.
- Configurar CORS para el origen autorizado.
- Manejar fallos de conexión con OpenAI.
- No devolver información interna del servidor.

## 10. Pruebas

Comprobar individualmente:

1. Que el servidor arranque.
2. Que `GET /api/health` funcione.
3. Que `POST /api/chat` valide solicitudes.
4. Que responda correctamente a mensajes válidos.
5. Que gestione errores de OpenAI.
6. Que el conocimiento institucional se aplique a las respuestas.

Verificar el endpoint mediante una herramienta de prueba HTTP o PowerShell.

Después comprobar la integración desde el frontend.

## 11. Forma de trabajo

No construir todo el backend de golpe.

Primero inspeccionar los archivos existentes y presentar una estructura propuesta.

Esperar aprobación antes de instalar paquetes o modificar archivos.

Implementar por etapas, explicar la función de cada archivo y proporcionar los comandos de prueba.

El objetivo es un backend funcional, seguro y fácil de explicar, no una arquitectura empresarial innecesariamente compleja.
