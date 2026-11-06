import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import type { useConversation } from '../hooks/useConversation'
import type { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import type { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import {
  quickActionsFor,
  PROFILE_LABEL,
  nextProfile,
} from '../data/quickActions'
import { DEMO_MODE } from '../services/chatApi'
import { MicIcon, SpeakerIcon, StopIcon } from './icons'
import type { ProfileId } from '../types/chat'

type Conversation = ReturnType<typeof useConversation>
type Voice = ReturnType<typeof useSpeechSynthesis>
type Recognition = ReturnType<typeof useSpeechRecognition>

const MAX_MESSAGE_LENGTH = 1000

interface ChatScreenProps {
  profile: ProfileId | null
  onSetProfile: (profile: ProfileId | null) => void
  conversation: Conversation
  voice: Voice
  recognition: Recognition
  /** Borrador dictado por voz que debe integrarse en el campo. */
  voiceDraft: string
  onConsumeVoiceDraft: () => void
  autoSpeak: boolean
  onToggleAutoSpeak: () => void
  onRestart: () => void
  onGoHome: () => void
}

export function ChatScreen({
  profile,
  onSetProfile,
  conversation,
  voice,
  recognition,
  voiceDraft,
  onConsumeVoiceDraft,
  autoSpeak,
  onToggleAutoSpeak,
  onRestart,
  onGoHome,
}: ChatScreenProps) {
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  const quickActions = quickActionsFor(profile)

  // Integrar el dictado de voz en el campo de texto.
  useEffect(() => {
    if (!voiceDraft) return
    setInput((current) =>
      current.trim() ? `${current.trimEnd()} ${voiceDraft}` : voiceDraft,
    )
    onConsumeVoiceDraft()
    inputRef.current?.focus()
  }, [voiceDraft, onConsumeVoiceDraft])

  // Auto-scroll al llegar mensajes nuevos.
  useEffect(() => {
    const log = logRef.current
    if (!log) return
    log.scrollTop = log.scrollHeight
  }, [conversation.messages, conversation.isThinking])

  const handleSend = async (rawText?: string) => {
    const text = (rawText ?? input).trim()
    if (!text || conversation.isThinking) return

    recognition.stop(true)
    voice.cancel()
    setInput('')

    await conversation.ask(text)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    void handleSend()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  const hasMessages = conversation.messages.length > 0
  const voiceNotice =
    [recognition.error, voice.error].filter(Boolean).join(' ') || null
  const hasError = Boolean(conversation.error ?? voiceNotice)

  return (
    <section className="gw-chat" aria-labelledby="chat-title">
      <div className="gw-chat__head">
        <p className="gw-chat__crumb">
          <strong>Conversación</strong>
          {profile && (
            <button
              type="button"
              className="gw-profilechip"
              onClick={() => onSetProfile(nextProfile(profile))}
              title="Tocar para corregir el perfil detectado"
            >
              {PROFILE_LABEL[profile]} · corregir
            </button>
          )}
        </p>
        <div className="gw-chat__actions">
          <button type="button" className="gw-chipbutton" onClick={onRestart}>
            Reiniciar
          </button>
          <button type="button" className="gw-chipbutton" onClick={onGoHome}>
            Inicio
          </button>
        </div>
      </div>

      <h2 id="chat-title" className="sr-only">
        Conversación con Growii
      </h2>

      <div className="gw-chat__log" ref={logRef} aria-live="polite">
        {!hasMessages ? (
          <div className="gw-chat__empty">
            <p className="gw-kicker">Growii · Red Alumni</p>
            <p className="gw-chat__empty-title">
              ¿En qué te ayudo
              <br />
              hoy?
            </p>
            {profile === null && (
              <div className="gw-identify" role="group" aria-label="Cuéntame quién eres (opcional)">
                <span className="gw-identify__label">
                  ¿Quién eres? (opcional)
                </span>
                <div className="gw-identify__chips">
                  {(
                    [
                      ['estudiante', 'Estudiante'],
                      ['alumni', 'Graduado'],
                      ['empresa', 'Empresa'],
                    ] as Array<[ProfileId, string]>
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      className="gw-chipbutton gw-chipbutton--profile"
                      onClick={() => onSetProfile(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {DEMO_MODE && (
              <p className="gw-msg__demo">
                Modo demostración — respuestas de prueba
              </p>
            )}
            <div className="gw-quickactions" aria-label="Consultas frecuentes">
              {quickActions.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="gw-quickaction"
                  onClick={() => void handleSend(question)}
                >
                  {question}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {conversation.messages.map((message) =>
              message.role === 'user' ? (
                <div key={message.id} className="gw-msg gw-msg--user">
                  <span className="gw-msg__meta">Tú</span>
                  <div className="gw-msg__body">{message.content}</div>
                </div>
              ) : (
                <div key={message.id} className="gw-msg gw-msg--assistant">
                  <span className="gw-msg__meta">Growii</span>
                  <div className="gw-msg__body">{message.content}</div>
                  {message.isDemo && (
                    <span className="gw-msg__demo">Respuesta de prueba</span>
                  )}
                </div>
              ),
            )}

            {conversation.isThinking && (
              <div className="gw-working" role="status">
                <span className="gw-working__dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                Growii está pensando
              </div>
            )}
          </>
        )}
      </div>

      {hasError && (
        <div className="gw-error" role="alert">
          <span>{conversation.error ?? voiceNotice}</span>
          <span className="gw-error__actions">
            {conversation.error && (
              <button
                type="button"
                className="gw-chipbutton"
                onClick={() => void conversation.retry()}
              >
                Reintentar
              </button>
            )}
            <button
              type="button"
              className="gw-chipbutton"
              onClick={() => {
                conversation.clearError()
                recognition.clearError()
                voice.clearError()
              }}
            >
              Descartar
            </button>
          </span>
        </div>
      )}

      <form className="gw-composer" onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          className="gw-composer__field"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu pregunta o toca el micrófono…"
          rows={2}
          maxLength={MAX_MESSAGE_LENGTH}
          aria-label="Escribe tu pregunta para Growii"
          disabled={conversation.isThinking}
        />
        <div className="gw-composer__row">
          {recognition.isSupported && (
            <button
              type="button"
              className={`gw-iconbutton${
                recognition.isListening ? ' is-active' : ''
              }`}
              onClick={recognition.toggle}
              aria-pressed={recognition.isListening}
              aria-label={
                recognition.isListening
                  ? 'Detener dictado'
                  : 'Dictar con el micrófono'
              }
              title={recognition.isListening ? 'Detener dictado' : 'Dictar'}
            >
              {recognition.isListening ? <StopIcon /> : <MicIcon />}
            </button>
          )}
          <button
            type="button"
            className={`gw-iconbutton${
              voice.isSpeaking || autoSpeak ? ' is-active' : ''
            }`}
            onClick={() => (voice.isSpeaking ? voice.cancel() : onToggleAutoSpeak())}
            aria-pressed={autoSpeak}
            aria-label={
              voice.isSpeaking
                ? 'Detener la voz de Growii'
                : autoSpeak
                  ? 'Desactivar voz automática'
                  : 'Activar voz automática'
            }
            title={voice.isSpeaking ? 'Detener voz' : 'Voz automática'}
          >
            {voice.isSpeaking ? <StopIcon /> : <SpeakerIcon muted={!autoSpeak} />}
          </button>
          <button
            type="submit"
            className="gw-button gw-button--primary gw-send"
            disabled={conversation.isThinking || !input.trim()}
          >
            Enviar →
          </button>
        </div>
      </form>
    </section>
  )
}
