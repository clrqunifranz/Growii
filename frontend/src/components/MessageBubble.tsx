import type { ChatMessage } from '../types/chat'

interface MessageBubbleProps {
  message: ChatMessage
  index: number
  canSpeak: boolean
  onSpeak: (text: string) => void
}

export function MessageBubble({
  message,
  index,
  canSpeak,
  onSpeak,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <article className={`message message--${message.role}`}>
      <div className="message__meta">
        <span className="message__index">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="message__role">{isUser ? 'TÚ' : 'ALMA'}</span>
        {message.isDemo && (
          <span
            className="message__demo"
            title="Respuesta de prueba local, no proviene del backend"
          >
            DEMO
          </span>
        )}
      </div>

      <div className="message__body">
        <p className="message__content">{message.content}</p>

        {!isUser && canSpeak && (
          <button
            type="button"
            className="message__action"
            onClick={() => onSpeak(message.content)}
          >
            ESCUCHAR <span aria-hidden="true">↗</span>
          </button>
        )}
      </div>
    </article>
  )
}
