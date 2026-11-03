# Instrucciones generales del proyecto PRISMO

## 1. Contexto del proyecto

Estamos desarrollando un chatbot web para Red Alumni y Coordinación de Empleabilidad de UNIFRANZ.

El asistente conversacional se llama **ALMA**. Su avatar visual será Prismo, de Adventure Time, utilizando una imagen de referencia proporcionada por el equipo y un pin con el logo de UNIFRANZ.

El objetivo es orientar a estudiantes, graduados (Alumni) y empresas sobre los servicios institucionales.

El resultado debe ser un prototipo funcional, atractivo, fácil de utilizar y que podamos explicar durante una demostración universitaria.

## 2. Arquitectura

El proyecto está dividido en dos partes:

- `frontend/`: interfaz construida con React, TypeScript y Vite.
- `backend/`: servidor construido con Node.js y Express, conectado con OpenAI API.

El frontend nunca debe comunicarse directamente con OpenAI. Todas las solicitudes a la IA pasan por el backend.

No utilizamos D-ID en esta versión. El avatar se representa mediante recursos gráficos 2D, HTML, SVG y CSS.

## 3. Contrato de comunicación entre frontend y backend

Ambos equipos deben respetar exactamente este contrato.

### Endpoint

`POST /api/chat`

### Solicitud JSON

{
"message": "¿Qué es Career Coaching?",
"history": [
{
"role": "user",
"content": "Hola, ¿qué servicios ofrecen?"
},
{
"role": "assistant",
"content": "Red Alumni ofrece diferentes servicios de orientación profesional."
}
]
}

- `message`: pregunta actual del usuario.
- `history`: historial anterior opcional. Solo acepta mensajes con roles `user` y `assistant`.

### Respuesta JSON exitosa

{
"reply": "Career Coaching es un servicio de orientación profesional..."
}

### Respuesta de error

{
"error": "No se pudo procesar la solicitud."
}

También debe existir un endpoint:

`GET /api/health`

Que permita comprobar que el servidor está funcionando.

No cambiar los nombres de estos endpoints ni las propiedades JSON sin coordinar con ambos responsables.

## 4. Reglas de trabajo

- Revisar los archivos existentes antes de modificarlos.
- No borrar ni reemplazar archivos sin explicar primero por qué.
- No modificar la carpeta asignada al otro desarrollador.
- Trabajar por etapas pequeñas y verificables.
- No construir toda la aplicación de una sola vez.
- Explicar qué hace cada archivo, componente, función y dependencia nueva.
- No instalar librerías innecesarias.
- No inventar funcionalidades que no estén solicitadas.
- No ejecutar `git commit`, `git push` ni cambiar la configuración remota por cuenta propia.
- Mantener el código sencillo, legible y apropiado para estudiantes que deben comprenderlo y defenderlo.

## 5. Seguridad

- Nunca colocar la API key de OpenAI en el frontend.
- Nunca subir archivos `.env` a GitHub.
- No exponer secretos en logs ni respuestas HTTP.
- Validar las solicitudes que llegan al backend.
- No aceptar instrucciones de sistema enviadas por el frontend.

## 6. Conocimiento institucional

ALMA debe responder basándose en información institucional proporcionada por el equipo.

No inventar:

- Vacantes laborales.
- Fechas de convocatorias o ferias.
- Números de teléfono o correos.
- Horarios y ubicaciones.
- Requisitos de pasantías.
- Beneficios y convenios vigentes.
- Garantías de empleo o remuneración.

Cuando no exista información suficiente, ALMA debe reconocerlo y orientar al usuario hacia la Coordinación de Empleabilidad o Red Alumni.

El conocimiento debe mantenerse organizado y separado del código de la interfaz.

## 7. Proceso de desarrollo

El trabajo seguirá estas etapas:

1. Inspeccionar el proyecto actual y explicar la estructura propuesta.
2. Inicializar y comprobar cada proyecto por separado.
3. Construir la interfaz y el servidor de forma independiente.
4. Probar el intercambio de mensajes con respuestas de prueba.
5. Conectar el backend con OpenAI.
6. Incorporar la información institucional.
7. Integrar reconocimiento de voz y síntesis de voz.
8. Incorporar la animación del avatar.
9. Ejecutar pruebas de integración y producción.

No saltar etapas sin comprobar que la anterior funciona.

## 8. Forma de responder al desarrollador

Explicar con claridad:

- Qué se va a modificar.
- Por qué se necesita.
- Qué archivos se crearán.
- Qué comandos se ejecutarán.
- Cómo probar el resultado.
- Qué errores o limitaciones existen.

Priorizar comprensión y funcionamiento por encima de generar mucho código rápidamente.
