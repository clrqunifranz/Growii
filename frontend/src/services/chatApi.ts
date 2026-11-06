import type {
  ChatApiMessage,
  ChatErrorResponse,
  ChatResponse,
  ChatResult,
} from '../types/chat'

const DEFAULT_BASE_URL = 'http://localhost:3000'
const REQUEST_TIMEOUT_MS = 130_000

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

export async function sendChatMessage(payload: {
  message: string
  history: ChatApiMessage[]
}): Promise<ChatResult> {
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
      console.debug(`[GROWII] Backend devolvió HTTP ${response.status}.`)
      throw new Error(
        apiMessage ||
          'Growii no pudo procesar la solicitud. Intenta nuevamente.',
      )
    }

    if (!isChatResponse(data) || !data.reply.trim()) {
      throw new Error('Recibimos una respuesta inesperada del servidor.')
    }

    return {
      reply: data.reply.trim(),
    }
  } catch (caughtError) {
    if (
      typeof caughtError === 'object' &&
      caughtError !== null &&
      'name' in caughtError &&
      (caughtError as { name?: string }).name === 'AbortError'
    ) {
      console.debug('[GROWII] La petición al backend superó el tiempo de espera.')
      throw new Error(
        'Growii está tardando más de lo esperado. Intenta nuevamente.',
      )
    }

    if (caughtError instanceof TypeError) {
      console.debug('[GROWII] No se pudo conectar con el backend.')
      throw new Error(
        'No pudimos conectar con Growii. Verifica que el servidor esté en ejecución.',
      )
    }

    throw caughtError instanceof Error
      ? caughtError
      : new Error('No se pudo procesar la solicitud.')
  } finally {
    window.clearTimeout(timeoutId)
  }
}
