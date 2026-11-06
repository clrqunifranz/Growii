# ALMA — Frontend

Interfaz de **ALMA**, asistente de Red Alumni y Coordinación de Empleabilidad de UNIFRANZ.

Construida con React, TypeScript, Vite, CSS, Fetch API y Web Speech API. No usa Next.js, Create React App, D-ID ni librerías de UI o animación.

La experiencia principal es una conversación por voz con **Prismo** como protagonista. El chat clásico sigue disponible de forma secundaria y compartida.

## Requisitos

- Node.js 20.19 o superior (probado con Node 24).
- npm 10 o superior.
- Chrome o Edge para la mejor compatibilidad con reconocimiento de voz.

## Ejecutar

```bash
npm install
npm run dev
```

La aplicación queda disponible en `http://localhost:5173`.

## Experiencia principal — voz

Al abrir la página:

1. Se muestra Prismo grande y centrado.
2. Aparece una identidad institucional pequeña y un indicador discreto de estado.
3. No se muestran burbujas ni transcripciones.
4. El botón principal es el micrófono.
5. ALMA saluda solamente después de un gesto del usuario: pulsar el micrófono inicia la sesión y reproduce:

   > ¡Hola! ¿Qué tal? Soy ALMA, tu asistente de Red Alumni. ¿En qué puedo ayudarte hoy?

Navegadores basados en los modos habituales de autoplay no reproducen audio sin interacción. Por eso la primera pulsación siempre es un gesto autorizado.

### Estados

- **ALMA ESTÁ LISTA**: paso inicial.
- **EN LÍNEA**: Prismo está disponible.
- **ESCUCHANDO**: el micrófono está capturando la pregunta.
- **ALMA ESTÁ PENSANDO**: espera la respuesta del backend.
- **ALMA ESTÁ HABLANDO**: ALMA responde mediante audio.

En `EN LÍNEA`, Prismo tiene la boca cerrada. En `ESCUCHANDO` y `PENSANDO`, también. En `HABLANDO`, alterna entre las imágenes de boca abierta y cerrada cada 170 ms.

### Conversación

- Pulsa el micrófono para hablar.
- Vuelve a pulsar para detener la escucha.
- ALMA responde mediante síntesis de voz.
- La pregunta y la respuesta se agregan al historial de la conversación.
- ALMA conserva el contexto entre preguntas.
- Mientras ALMA habla, el micrófono puede detener la voz.
- Si ocurre un error, aparece un aviso breve con `REINTENTAR`.

### Modo texto secundario

En la parte superior derecha aparece el botón **TEXTO**. Abre la interfaz de chat tradicional, con:

- Encabezado editorial ALMA.
- Selector de perfil.
- Preguntas sugeridas.
- Transcripción.
- Compositor, dictado y reproducción de voz.

El historial es el mismo para voz y texto. Para volver al modo principal, pulsa **VOZ**.

## Modo demostración y backend

Si no existe `VITE_USE_MOCK`, o tiene cualquier valor distinto de `false`, el frontend funciona en **modo demostración**.

En el encabezado aparece un distintivo compacto: `DEMO LOCAL`. Las respuestas son de prueba y no provienen de ALMA.

Para conectar el backend real, crea `frontend/.env.local`:

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:3000
```

Después, reinicia `npm run dev`.

El backend debe permitir CORS para:

- `http://localhost:5173` (desarrollo)
- `http://localhost:4173` (preview)

No coloques una API key de OpenAI en el frontend. La única variable relacionada con la IA es la URL del backend.

## Contrato consumido

`src/services/chatApi.ts` consume exactamente:

```http
POST /api/chat
Content-Type: application/json
```

```json
{
  "message": "¿Qué es Career Coaching?",
  "history": [
    { "role": "user", "content": "Hola, ¿qué servicios ofrecen?" },
    { "role": "assistant", "content": "Red Alumni ofrece diferentes servicios de orientación profesional." }
  ]
}
```

Respuesta exitosa:

```json
{ "reply": "Career Coaching es un servicio de orientación profesional..." }
```

Respuesta de error:

```json
{ "error": "No se pudo procesar la solicitud." }
```

Se envían como máximo los últimos 20 mensajes. La pregunta actual no se duplica en `history`.

## Recursos del avatar

El componente `src/components/Avatar.tsx` usa un mapa centralizado de rutas en `src/config/prismo-assets.ts`.

Los archivos nuevos deben colocarse en:

`public/assets/prismo/`

Recursos esperados:

- `prismo-idle.png`
- `prismo-greeting.png`
- `prismo-listening.png`
- `prismo-thinking.png`
- `prismo-speaking-open.png`
- `prismo-speaking-closed.png`
- `prismo-explaining-open.png`
- `prismo-explaining-closed.png`
- `prismo-blink.png`

Mientras los archivos nuevos no estén disponibles, el frontend usa como fallback las imágenes existentes:

- `/assets/prismo-mouth-closed.jpg`
- `/assets/prismo-mouth-open.png`

Comportamiento:

- Entrada / saludo: `greeting`.
- Escucha: `listening`.
- Mientras espera al backend: `thinking`.
- Hablando con respuesta normal: alterna `speaking-open` y `speaking-closed`.
- Hablando con pasos, instrucciones o recomendaciones: alterna `explaining-open` y `explaining-closed`.
- `blink` se usa ocasionalmente y solo mientras espera.
- Sin alternancia cuando `prefers-reduced-motion` está activo.
- La boca y las dos imágenes se alternan aproximadamente cada 120–180 ms.

El logo institucional conserva su proporción. La placa usa una proporción 9:16 y `object-fit: contain`, por lo que la imagen se muestra completa y sin recortar al personaje.

La animación de boca es aproximada y no representa sincronización labial real.

## Voz

- **Dictado:** Web Speech API con `SpeechRecognition` y `webkitSpeechRecognition`; intenta `es-BO` y cae a `es-ES` si el navegador no admite el idioma.
- **Lectura:** `speechSynthesis` y `SpeechSynthesisUtterance`, priorizando voces españolas.
- **Permisos:** si el navegador no admite alguna API o el usuario niega el micrófono, aparece un aviso pequeño con opción de reintentar; el modo texto sigue disponible.
- **Autoplay:** el saludo inicial no se reproduce antes del primer gesto del usuario.

## Estructura

```text
src/
  components/
    Avatar.tsx
    VoiceExperience.tsx       # experiencia principal por voz
    TextExperience.tsx        # experiencia secundaria de chat
    Header.tsx
    ChatPanel.tsx
    ChatInput.tsx
    MessageBubble.tsx
    MessageList.tsx
    ProfileSelector.tsx
    StatusIndicators.tsx
    VoiceControls.tsx
    icons.tsx
  config/
    prismo-assets.ts
  data/
    suggestedQuestions.ts
  hooks/
    useConversation.ts        # historial y llamadas al backend
    useSpeechRecognition.ts
    useSpeechSynthesis.ts
  services/
    chatApi.ts
  App.tsx
  App.css
```

## Verificación rápida

1. `npm run dev`.
2. La página abre con Prismo y sin burbujas visibles.
3. Espera la invitación `TOCA PARA SALUDAR`.
4. Pulsa el micrófono y escucha el saludo.
5. Pulsa el micrófono otra vez, habla y vuelve a pulsar para terminar.
6. Comprueba que ALMA responde con voz.
7. Verifica que el modo voz no muestra transcripciones ni burbujas.
8. Haz una segunda pregunta y confirma que conserva el contexto.
9. Pulsa `TEXTO` y comprueba que aparece el chat tradicional con el historial.
10. Desde el chat, pulsa `VOZ` para volver.
11. Ejecuta `npm run build`.

## Notas de alcance

- No hay historial persistente ni base de datos: la conversación vive en memoria.
- El perfil seleccionado solo filtra las preguntas sugeridas; no se envía al backend.
- La comprobación automatizada valida el flujo con un micrófono simulado en navegador. La prueba final con micrófono físico requiere Chrome o Edge y el permiso local del sistema. En ese entorno deben verificarse: apertura de ALMA, saludo, dictado real, respuesta hablada, animación de boca y regreso a `EN LÍNEA`.
- El modo demo local sirve para revisión visual; para respuestas institucionales reales, usa el backend.
- No se inventan vacantes, fechas, contactos, horarios, requisitos, convenios ni beneficios.
