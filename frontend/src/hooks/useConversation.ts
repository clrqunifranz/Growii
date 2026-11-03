import { useCallback, useRef, useState } from 'react'
import { sendChatMessage } from '../services/chatApi'
import type { ChatApiMessage, ChatMessage } from '../types/chat'

const MAX_HISTORY_MESSAGES = 20

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

  const ask = useCallback(
    async (rawText: string) => {
      const text = rawText.trim()

      if (!text || isThinking) return null

      console.debug('[ALMA] Pregunta captada; preparando solicitud al backend.')
      const history: ChatApiMessage[] = messages
        .slice(-MAX_HISTORY_MESSAGES)
        .map(({ role, content }) => ({ role, content }))

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
        console.debug('[ALMA] Enviando POST /api/chat.')
        const result = await sendChatMessage({ message: text, history })
        console.debug(`[ALMA] Respuesta del backend recibida: ${result.reply.length} caracteres.`)

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
        console.debug('[ALMA] La respuesta del backend no pudo utilizarse.')
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
  }
}
