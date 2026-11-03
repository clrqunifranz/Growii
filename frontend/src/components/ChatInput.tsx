import { useEffect, type KeyboardEvent, type RefObject } from 'react'
import { VoiceControls } from './VoiceControls'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  inputRef: RefObject<HTMLTextAreaElement | null>
  isListening: boolean
  onMicToggle: () => void
  recognitionSupported: boolean
  isSpeaking: boolean
  onStopSpeaking: () => void
  synthesisSupported: boolean
  autoSpeak: boolean
  onToggleAutoSpeak: () => void
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
  inputRef,
  isListening,
  onMicToggle,
  recognitionSupported,
  isSpeaking,
  onStopSpeaking,
  synthesisSupported,
  autoSpeak,
  onToggleAutoSpeak,
}: ChatInputProps) {
  useEffect(() => {
    const element = inputRef.current
    if (!element) return

    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 140)}px`
  }, [inputRef, value])

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      onSubmit()
    }
  }

  return (
    <form
      className="chat-composer"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <div className="composer__label">
        <label htmlFor="chat-input">TU PREGUNTA</label>
        <span>{value.length} / 2000</span>
      </div>

      <div className="composer__field-row">
        <textarea
          id="chat-input"
          ref={inputRef}
          className="composer__input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={2000}
          placeholder="Escribe tu pregunta…"
          aria-describedby="composer-hint"
          disabled={disabled}
        />

        <div className="composer__actions">
          <VoiceControls
            disabled={disabled}
            isListening={isListening}
            onMicToggle={onMicToggle}
            recognitionSupported={recognitionSupported}
            isSpeaking={isSpeaking}
            onStopSpeaking={onStopSpeaking}
            synthesisSupported={synthesisSupported}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={onToggleAutoSpeak}
          />

          <button
            type="submit"
            className="icon-button icon-button--send"
            disabled={disabled || !value.trim()}
            aria-label="Enviar pregunta"
            title="Enviar pregunta"
          >
            <span aria-hidden="true">↗</span>
          </button>
        </div>
      </div>

      <div className="composer__hint" id="composer-hint">
        <span>ENTER ENVIAR · SHIFT+ENTER SALTO</span>
        <span>{isListening ? 'DICTADO ACTIVO' : 'ES-BO'}</span>
      </div>
    </form>
  )
}
