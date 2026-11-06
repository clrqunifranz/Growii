import type { RefObject } from 'react'
import type { ChatMessage } from '../types/chat'
import { ChatInput } from './ChatInput'
import { MessageList } from './MessageList'
import { StatusIndicators, type ChatStatus } from './StatusIndicators'

interface ChatPanelProps {
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  voiceNotice: string | null
  input: string
  onInputChange: (value: string) => void
  onSend: () => void
  onSpeak: (text: string) => void
  onDismissError: () => void
  onDismissVoiceNotice: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  status: ChatStatus
  isListening: boolean
  onMicToggle: () => void
  recognitionSupported: boolean
  isSpeaking: boolean
  onStopSpeaking: () => void
  synthesisSupported: boolean
  autoSpeak: boolean
  onToggleAutoSpeak: () => void
}

export function ChatPanel({
  messages,
  isLoading,
  error,
  voiceNotice,
  input,
  onInputChange,
  onSend,
  onSpeak,
  onDismissError,
  onDismissVoiceNotice,
  inputRef,
  status,
  isListening,
  onMicToggle,
  recognitionSupported,
  isSpeaking,
  onStopSpeaking,
  synthesisSupported,
  autoSpeak,
  onToggleAutoSpeak,
}: ChatPanelProps) {
  return (
    <section className="chat-panel" aria-labelledby="chat-title">
      <header className="chat-panel__head">
        <div>
          <p className="section-label">
            <span>02 / CONVERSACIÓN</span>
            <span>{String(messages.length).padStart(2, '0')} MENSAJES</span>
          </p>
          <h2 id="chat-title" className="sr-only">
            Conversación con ALMA
          </h2>
        </div>
        <StatusIndicators status={status} />
      </header>

      <MessageList
        messages={messages}
        isLoading={isLoading}
        canSpeak={synthesisSupported}
        onSpeak={onSpeak}
      />

      {error && (
        <div className="notice notice--error" role="alert">
          <div className="notice__head">
            <span className="notice__label">ERROR</span>
            <button type="button" onClick={onDismissError}>
              CERRAR
            </button>
          </div>
          <p>{error}</p>
        </div>
      )}

      {voiceNotice && (
        <div className="notice notice--voice" role="status">
          <div className="notice__head">
            <span className="notice__label">VOZ / AVISO</span>
            <button type="button" onClick={onDismissVoiceNotice}>
              CERRAR
            </button>
          </div>
          <p>{voiceNotice}</p>
        </div>
      )}

      <ChatInput
        value={input}
        onChange={onInputChange}
        onSubmit={onSend}
        disabled={isLoading}
        inputRef={inputRef}
        isListening={isListening}
        onMicToggle={onMicToggle}
        recognitionSupported={recognitionSupported}
        isSpeaking={isSpeaking}
        onStopSpeaking={onStopSpeaking}
        synthesisSupported={synthesisSupported}
        autoSpeak={autoSpeak}
        onToggleAutoSpeak={onToggleAutoSpeak}
      />
    </section>
  )
}
