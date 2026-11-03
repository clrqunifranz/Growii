import { useEffect, useRef } from 'react'
import type { ChatMessage } from '../types/chat'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: ChatMessage[]
  isLoading: boolean
  canSpeak: boolean
  onSpeak: (text: string) => void
}

export function MessageList({
  messages,
  isLoading,
  canSpeak,
  onSpeak,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (messages.length === 0 && !isLoading) return

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    bottomRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: 'end',
    })
  }, [messages, isLoading])

  return (
    <div className="chat-scroll">
      <div className="transcript" role="log" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && !isLoading && (
          <div className="chat-empty">
            <p className="chat-empty__index">01 / EMPIEZA AQUÍ</p>
            <h2>Pregunta lo que necesites.</h2>
            <p>
              Consulta sobre empleabilidad, pasantías, Career Coaching o Red
              Alumni. También puedes dictar tu pregunta con el micrófono.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <MessageBubble
            key={message.id}
            message={message}
            index={index}
            canSpeak={canSpeak}
            onSpeak={onSpeak}
          />
        ))}

        {isLoading && (
          <div className="message message--assistant message--thinking">
            <div className="message__meta">
              <span className="message__index">
                {String(messages.length + 1).padStart(2, '0')}
              </span>
              <span className="message__role">ALMA</span>
            </div>
            <div className="message__body">
              <span className="thinking" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="thinking__label">PENSANDO</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} className="transcript__end" />
      </div>
    </div>
  )
}
