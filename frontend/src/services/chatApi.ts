import type {
  ChatApiMessage,
  ChatErrorResponse,
  ChatResponse,
  ChatResult,
} from '../types/chat'

const DEFAULT_BASE_URL = 'http://localhost:3000'
const REQUEST_TIMEOUT_MS = 20_000

export const DEMO_MODE =
  (import.meta.env.VITE_USE_MOCK ?? 'true').toLowerCase() !== 'false'

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL
).replace(/\/+$/, '')

function isChatResponse(value: unknown): value is ChatResponse {
  if (!value || typeof value !== 'object') return false
  return typeof (value as ChatResponse).reply === 'string'
}

function isChatErrorResponse(value: unknown): value is ChatErrorResponse {
  if (!value || typeof value !== 'object') return false
  return typeof (value as ChatErrorResponse).error === 'string'
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function buildDemoReply(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim()
  const excerpt = clean.length > 90 ? `${clean.slice(0, 90)}…` : clean

  return [
    'Esta es una respuesta de prueba del frontend. No proviene de ALMA ni del backend.',
    `He recibido tu pregunta: «${excerpt}».`,
    'El modo demostración está activo. Cuando conectes el servidor, ALMA responderá con información institucional verificada y el historial se enviará con el contrato de /api/chat.',
    'La interfaz, los estados de voz y el formato de conversación ya están listos para la integración.',
  ].join('\n\n')
}

export async function sendChatMessage(payload: {
  message: string
  history: ChatApiMessage[]
}): Promise<ChatResult> {
  if (DEMO_MODE) {
    await wait(650 + Math.random() * 450)
    return {
      reply: buildDemoReply(payload.message),
      demo: true,
    }
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS,
  )

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        message: payload.message,
        history: payload.history,
      }),
      signal: controller.signal,
    })

    const rawBody = await response.text()
    let data: unknown = null

    if (rawBody) {
      try {
        data = JSON.parse(rawBody)
      } catch {
        data = null
      }
    }

    if (!response.ok) {
      const apiMessage = isChatErrorResponse(data) ? data.error?.trim() : ''
      console.debug(`[ALMA] Backend devolvió HTTP ${response.status}.`)
      throw new Error(
        apiMessage ||
          'ALMA no pudo procesar la solicitud. Intenta nuevamente.',
      )
    }

    if (!isChatResponse(data) || !data.reply.trim()) {
      throw new Error('Recibimos una respuesta inesperada del servidor.')
    }

    return {
      reply: data.reply.trim(),
      demo: false,
    }
  } catch (caughtError) {
    if (
      typeof caughtError === 'object' &&
      caughtError !== null &&
      'name' in caughtError &&
      (caughtError as { name?: string }).name === 'AbortError'
    ) {
      console.debug('[ALMA] La petición al backend superó el tiempo de espera.')
      throw new Error(
        'ALMA está tardando más de lo esperado. Intenta nuevamente.',
      )
    }

    if (caughtError instanceof TypeError) {
      console.debug('[ALMA] No se pudo conectar con el backend.')
      throw new Error(
        'No pudimos conectar con ALMA. Verifica que el servidor esté en ejecución.',
      )
    }

    throw caughtError instanceof Error
      ? caughtError
      : new Error('No se pudo procesar la solicitud.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}
