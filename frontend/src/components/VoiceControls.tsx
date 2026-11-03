import { MicIcon, SpeakerIcon, StopIcon } from './icons'

interface VoiceControlsProps {
  disabled: boolean
  isListening: boolean
  onMicToggle: () => void
  recognitionSupported: boolean
  isSpeaking: boolean
  onStopSpeaking: () => void
  synthesisSupported: boolean
  autoSpeak: boolean
  onToggleAutoSpeak: () => void
}

export function VoiceControls({
  disabled,
  isListening,
  onMicToggle,
  recognitionSupported,
  isSpeaking,
  onStopSpeaking,
  synthesisSupported,
  autoSpeak,
  onToggleAutoSpeak,
}: VoiceControlsProps) {
  return (
    <div className="voice-controls">
      <button
        type="button"
        className={`icon-button icon-button--mic ${
          isListening ? 'is-active' : ''
        }`}
        onClick={onMicToggle}
        disabled={disabled || !recognitionSupported}
        aria-pressed={isListening}
        aria-label={
          !recognitionSupported
            ? 'El dictado por voz no está disponible en este navegador'
            : isListening
              ? 'Detener dictado'
              : 'Iniciar dictado'
        }
        title={
          !recognitionSupported
            ? 'Tu navegador no permite dictado por voz'
            : isListening
              ? 'Detener dictado'
              : 'Dictar pregunta'
        }
      >
        {isListening ? <StopIcon /> : <MicIcon />}
      </button>

      <button
        type="button"
        className={`voice-toggle ${autoSpeak ? 'is-on' : ''}`}
        onClick={onToggleAutoSpeak}
        disabled={!synthesisSupported}
        aria-pressed={autoSpeak}
        aria-label={
          autoSpeak
            ? 'Desactivar lectura automática de respuestas'
            : 'Activar lectura automática de respuestas'
        }
        title={
          synthesisSupported
            ? autoSpeak
              ? 'Lectura automática activa'
              : 'Lectura automática desactivada'
            : 'Tu navegador no permite síntesis de voz'
        }
      >
        <SpeakerIcon muted={!autoSpeak} />
        <span>{autoSpeak ? 'VOZ ON' : 'VOZ OFF'}</span>
      </button>

      {isSpeaking && (
        <button
          type="button"
          className="voice-stop"
          onClick={onStopSpeaking}
        >
          DETENER
        </button>
      )}
    </div>
  )
}
