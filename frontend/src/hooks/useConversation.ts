import { useCallback, useRef, useState } from 'react'
import { sendChatMessage } from '../services/chatApi'
import { logEvent } from '../utils/telemetry'
import type { ChatApiMessage, ChatMessage } from '../types/chat'

// El backend valida un máximo de 10 mensajes en el historial (y 4000 caracteres
// por mensaje); el frontend debe respetar el mismo contrato.
const MAX_HISTORY_MESSAGES = 10
const MAX_HISTORY_CONTENT_LENGTH = 4000
const MAX_MESSAGE_LENGTH = 1000

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function friendlyConversationError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'No se pudo procesar la solicitud.'
}

export function useConversation() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isThinking, setIsThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pendingQuestionRef = useRef<string | null>(null)

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const reset = useCallback(() => {
    pendingQuestionRef.current = null
    setMessages([])
    setError(null)
    setIsThinking(false)
  }, [])

  const ask = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()

      if (!text || isThinking) return null

      if (text.length > MAX_MESSAGE_LENGTH) {
        setError(`Tu pregunta supera el máximo de ${MAX_MESSAGE_LENGTH} caracteres.`)
        return null
      }

      logEvent('send', `Pregunta: «${text.slice(0, 140)}»`)
      console.debug('[GROWII] Pregunta captada; preparando solicitud al backend.')
      const history: ChatApiMessage[] = messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map(({ role, content }) => ({
          role,
          content: content.slice(0, MAX_HISTORY_CONTENT_LENGTH),
        }))

      const userMessage: ChatMessage = {
        id: createId(),
        role: 'user',
        content: text,
        createdAt: Date.now(),
      }

      pendingQuestionRef.current = text
      setIsThinking(true)
      setError(null)

      try {
        console.debug('[GROWII] Enviando POST /api/chat.')
        const result = await sendChatMessage({ message: text, history })
        console.debug(`[GROWII] Respuesta del backend recibida: ${result.reply.length} caracteres.`)
        logEvent('response', `Respuesta recibida (${result.reply.length} caracteres)`)

        const assistantMessage: ChatMessage = {
          id: createId(),
          role: 'assistant',
          content: result.reply,
          createdAt: Date.now(),
          isDemo: result.demo,
        }

        setMessages((previous) => [...previous, userMessage, assistantMessage])
        pendingQuestionRef.current = null
        return result.reply
      } catch (caughtError) {
        console.debug('[GROWII] La respuesta del backend no pudo utilizarse.')
        logEvent('error', `Chat: ${friendlyConversationError(caughtError)}`, false)
        setError(friendlyConversationError(caughtError))
        return null
      } finally {
        setIsThinking(false)
      }
    },
    [isThinking, messages],
  )

  const retry = useCallback(async () => {
    const pendingQuestion = pendingQuestionRef.current
    if (!pendingQuestion) return null

    return ask(pendingQuestion)
  }, [ask])

  return {
    messages,
    isThinking,
    error,
    ask,
    retry,
    clearError,
    reset,
  }
}
