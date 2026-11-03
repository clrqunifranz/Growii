import { useCallback, useEffect, useRef, useState } from 'react'
import type { useConversation } from '../hooks/useConversation'
import type { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { explainLikely } from '../utils/explain'
import type { PrismoStatus, PrismoSpeechVariant, VoiceState } from '../types/prismo'
import { Avatar } from './Avatar'
import { MicIcon, StopIcon } from './icons'

const GREETING =
  '¡Hola! ¿Qué tal? Soy ALMA, tu asistente de Red Alumni. ¿En qué puedo ayudarte hoy?'

/** Pose de entrada antes de pasar al reposo. */
const ENTRANCE_GREETING_MS = 1500

type Conversation = ReturnType<typeof useConversation>
type SpeechSynthesis = ReturnType<typeof useSpeechSynthesis>

interface VoiceExperienceProps {
  conversation: Conversation
  synthesis: SpeechSynthesis
  demoMode: boolean
  onOpenText: () => void
}

export function VoiceExperience({
  conversation,
  synthesis,
  demoMode,
  onOpenText,
}: VoiceExperienceProps) {
  const transcriptRef = useRef('')
  const lastReplyRef = useRef<string | null>(null)
  const wasSpeakingRef = useRef(false)
  /** true mientras esperamos a que el reconocimiento arranque de verdad. */
  const pendingListenRef = useRef(false)

  const [appState, setAppState] = useState<VoiceState>('greeting')
  const [entranceDone, setEntranceDone] = useState(false)
  const [speechText, setSpeechText] = useState<string | null>(null)
  const [speechVariant, setSpeechVariant] = useState<PrismoSpeechVariant>('answer')
  const [notice, setNotice] = useState<string | null>(null)
  const [greeted, setGreeted] = useState(false)

  // Al entrar: Prismo saluda ~1.5 s y transiciona suavemente al reposo.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setEntranceDone(true),
      ENTRANCE_GREETING_MS,
    )
    return () => window.clearTimeout(timer)
  }, [])

  const speakReply = useCallback(
    (reply: string) => {
      lastReplyRef.current = reply
      setSpeechText(reply)
      synthesis.cancel()
      synthesis.speak(reply)
    },
    [synthesis],
  )

  const askAndSpeak = useCallback(
    (text: string) => {
      void (async () => {
        synthesis.cancel()
        const reply = await conversation.ask(text)

        if (!reply) {
          setAppState('error')
          return
        }

        if (!synthesis.isSupported) {
          setNotice('La lectura por voz no está disponible en este navegador.')
          setAppState('error')
          return
        }

        setSpeechVariant(explainLikely(reply) ? 'guide' : 'answer')
        speakReply(reply)
      })()
    },
    [conversation, speakReply, synthesis],
  )

  const handleRecognitionEnd = useCallback(() => {
    pendingListenRef.current = false
    const text = transcriptRef.current.trim()
    transcriptRef.current = ''

    if (!text) {
      setNotice('No te escuché. Intenta nuevamente.')
      setAppState('error')
      return
    }

    // El resultado final llegó: comenzamos el procesamiento → "pensando".
    setAppState('thinking')
    setNotice(null)
    askAndSpeak(text)
  }, [askAndSpeak])

  const recognition = useSpeechRecognition({
    onText: (text) => {
      transcriptRef.current = text
    },
    onEnd: handleRecognitionEnd,
  })

  // El cambio a "escuchando" ocurre cuando el reconocimiento se inicia de verdad.
  useEffect(() => {
    if (recognition.isListening) {
      pendingListenRef.current = false
      setAppState((current) => (current === 'listening' ? current : 'listening'))
    }
  }, [recognition.isListening])

  useEffect(() => {
    if (conversation.error && appState === 'thinking') {
      setAppState('error')
    }
  }, [appState, conversation.error])

  useEffect(() => {
    if (
      recognition.error &&
      (appState === 'listening' || pendingListenRef.current)
    ) {
      pendingListenRef.current = false
      setAppState('error')
    }
  }, [appState, recognition.error])

  useEffect(() => {
    if (synthesis.error && appState !== 'idle') {
      setAppState('error')
    }
  }, [appState, synthesis.error])

  useEffect(() => {
    const speaking = synthesis.isSpeaking
    const canStartSpeech =
      appState === 'idle' ||
      appState === 'greeting' ||
      appState === 'thinking' ||
      appState === 'error'

    if (speaking && canStartSpeech) {
      setNotice(null)
      setAppState('speaking')
    }

    if (
      !speaking &&
      wasSpeakingRef.current &&
      (appState === 'speaking' ||
        appState === 'greeting' ||
        appState === 'error')
    ) {
      setAppState('idle')
    }

    wasSpeakingRef.current = speaking
  }, [appState, synthesis.isSpeaking])

  const error =
    notice ?? conversation.error ?? recognition.error ?? synthesis.error ?? null

  const startConversation = useCallback(() => {
    setGreeted(true)
    setNotice(null)
    synthesis.clearError()

    if (!synthesis.isSupported) {
      setNotice('La lectura por voz no está disponible en este navegador.')
      setAppState('error')
      return
    }

    setSpeechText(GREETING)
    synthesis.cancel()
    synthesis.speak(GREETING)
    setAppState('greeting')
  }, [synthesis])

  const startListening = useCallback(() => {
    if (conversation.isThinking || appState === 'thinking') return
    if (pendingListenRef.current) return

    if (!recognition.isSupported) {
      setNotice('El dictado por voz no está disponible en este navegador. Usa el modo TEXTO.')
      setAppState('error')
      return
    }

    synthesis.cancel()
    conversation.clearError()
    recognition.clearError()
    synthesis.clearError()
    setNotice(null)
    transcriptRef.current = ''
    pendingListenRef.current = true
    // No cambiamos a "listening" aquí: solo cuando recognition.onstart dispara.
    recognition.start()
  }, [appState, conversation, recognition, synthesis])

  const handleMicPress = useCallback(() => {
    if (appState === 'thinking') return

    if (synthesis.isSpeaking) {
      synthesis.cancel()
      return
    }

    if (appState === 'listening' || pendingListenRef.current) {
      pendingListenRef.current = false
      recognition.stop()
      return
    }

    if (!greeted) {
      startConversation()
      return
    }

    startListening()
  }, [appState, greeted, recognition, startConversation, startListening, synthesis])

  const retry = useCallback(async () => {
    if (conversation.error) {
      const reply = await conversation.retry()

      if (reply) {
        if (!synthesis.isSupported) {
          setNotice('La lectura por voz no está disponible en este navegador.')
          setAppState('error')
          return
        }

        setSpeechVariant(explainLikely(reply) ? 'guide' : 'answer')
        speakReply(reply)
        return
      }

      setAppState('error')
      return
    }

    if (synthesis.error && lastReplyRef.current) {
      synthesis.clearError()

      if (synthesis.isSupported) {
        speakReply(lastReplyRef.current)
        return
      }
    }

    setNotice(null)
    recognition.clearError()
    synthesis.clearError()
    startListening()
  }, [conversation, recognition, speakReply, startListening, synthesis])

  // Selección de pose derivada del estado real (nunca de temporizadores sueltos).
  const pose: PrismoStatus =
    appState === 'error'
      ? 'idle'
      : appState === 'greeting' && !greeted && entranceDone
        ? 'idle'
        : appState

  const showMicAsStop = appState === 'listening' || synthesis.isSpeaking

  const statusLabel =
    appState === 'error'
      ? 'NO SE PUDO CONECTAR'
      : appState === 'greeting'
        ? synthesis.isSpeaking
          ? 'ALMA ESTÁ HABLANDO'
          : 'ALMA ESTÁ LISTA'
        : appState === 'idle'
          ? 'EN LÍNEA'
          : appState === 'listening'
            ? 'ESCUCHANDO'
            : appState === 'thinking'
              ? 'ALMA ESTÁ PENSANDO'
              : 'ALMA ESTÁ HABLANDO'

  const prompt =
    appState === 'error'
      ? 'HUBO UN PROBLEMA'
      : !greeted
        ? 'TOCA PARA SALUDAR'
        : appState === 'listening'
          ? 'TE ESTOY ESCUCHANDO'
          : appState === 'thinking'
            ? 'ALMA ESTÁ PENSANDO'
            : appState === 'speaking'
              ? 'ALMA ESTÁ HABLANDO'
              : 'TOCA PARA HABLAR'

  const hint =
    appState === 'error'
      ? 'PULSA REINTENTAR'
      : appState === 'listening'
        ? 'PULSA PARA TERMINAR'
        : appState === 'thinking'
          ? 'UN MOMENTO'
          : appState === 'speaking'
            ? 'PULSA PARA DETENER'
            : !greeted
              ? 'ALMA y tú, sin ventanas'
              : synthesis.isSpeaking
                ? 'PULSA PARA DETENER'
                : 'PULSA PARA HABLAR'

  const micLabel =
    appState === 'error'
      ? 'Reintentar la conversación'
      : !greeted
        ? 'Iniciar la conversación con ALMA'
        : showMicAsStop
          ? appState === 'listening'
            ? 'Detener la escucha'
            : 'Detener la voz de ALMA'
          : 'Hablar con ALMA'

  return (
    <main className="voice-experience" aria-labelledby="voice-title">
      <div className="voice-space" aria-hidden="true">
        <svg
          className="voice-space__art"
          viewBox="0 0 1600 1000"
          preserveAspectRatio="xMidYMid slice"
          role="presentation"
          focusable="false"
        >
          <g className="voice-space__orbits">
            <ellipse cx="800" cy="500" rx="590" ry="180" transform="rotate(-18 800 500)" />
            <ellipse cx="800" cy="500" rx="760" ry="250" transform="rotate(-18 800 500)" />
            <ellipse cx="800" cy="500" rx="340" ry="105" transform="rotate(-18 800 500)" />
          </g>
          <g className="voice-space__planets">
            <circle cx="182" cy="225" r="34" className="voice-space__planet voice-space__planet--pink" />
            <path className="voice-space__planet-ring" d="M116 235 q66 38 132 0" />
            <circle cx="1400" cy="610" r="22" className="voice-space__planet voice-space__planet--gold" />
            <circle cx="1230" cy="150" r="12" className="voice-space__planet voice-space__planet--cream" />
          </g>
          <g className="voice-space__sparks">
            <path d="M160 410 l6 18 -6 18 -6 -18z" />
            <path d="M1445 280 l7 22 -7 22 -7 -22z" />
            <path d="M1120 790 l5 14 -5 14 -5 -14z" />
            <path d="M370 720 l5 16 -5 16 -5 -16z" />
          </g>
          <g className="voice-space__stars">
            <circle cx="250" cy="120" r="2" />
            <circle cx="430" cy="88" r="3" />
            <circle cx="610" cy="175" r="2" />
            <circle cx="940" cy="92" r="2" />
            <circle cx="1100" cy="200" r="3" />
            <circle cx="1325" cy="100" r="2" />
            <circle cx="1420" cy="390" r="2" />
            <circle cx="220" cy="590" r="2" />
            <circle cx="1290" cy="790" r="2" />
          </g>
          <g className="voice-space__particles">
            <circle cx="300" cy="640" r="2.1" />
            <circle cx="520" cy="770" r="1.6" />
            <circle cx="712" cy="560" r="2.4" />
            <circle cx="884" cy="700" r="1.7" />
            <circle cx="1052" cy="540" r="2" />
            <circle cx="1180" cy="742" r="1.5" />
            <circle cx="436" cy="468" r="1.4" />
          </g>
          <g className="voice-space__particles voice-space__particles--slow">
            <circle cx="380" cy="300" r="1.8" />
            <circle cx="660" cy="240" r="1.3" />
            <circle cx="1230" cy="330" r="2.2" />
            <circle cx="960" cy="260" r="1.5" />
          </g>
        </svg>
        <div className="voice-space__halo" />
      </div>

      <header className="voice-topbar">
        <p className="voice-identity">
          <span className="voice-identity__mark" aria-hidden="true" />
          RED ALUMNI <span className="voice-identity__slash">/</span> UNIFRANZ
        </p>

        <div className="voice-topbar__right">
          {demoMode && <span className="voice-demo">DEMO LOCAL</span>}
          <span className="voice-mode__label">ASISTENTE ALMA</span>
          <button type="button" className="voice-mode-button" onClick={onOpenText}>
            TEXTO
          </button>
        </div>
      </header>

      <h1 id="voice-title" className="sr-only">
        ALMA, asistente de Red Alumni
      </h1>

      <section className="voice-stage" aria-label="Prismo y ALMA">
        <Avatar
          status={pose}
          speechVariant={speechVariant}
          speechText={speechText}
          boundary={synthesis.boundary}
        />

        {error ? (
          <div className="voice-notice" role="alert">
            <span>{error}</span>
            <button type="button" onClick={() => void retry()}>
              REINTENTAR
            </button>
          </div>
        ) : null}

        {!recognition.isSupported && greeted ? (
          <button type="button" className="voice-text-fallback" onClick={onOpenText}>
            USAR EL MODO TEXTO
          </button>
        ) : null}
      </section>

      <div className="voice-panel" aria-label="Control de voz">
        <div
          className={`voice-status voice-status--${pose}`}
          role="status"
          aria-live="polite"
        >
          <span className="voice-status__dot" aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>

        <button
          type="button"
          className={`voice-mic${showMicAsStop ? ' voice-mic--stop' : ''}`}
          onClick={handleMicPress}
          disabled={appState === 'thinking'}
          aria-label={micLabel}
          aria-pressed={appState === 'listening'}
          title={micLabel}
        >
          {showMicAsStop ? (
            <StopIcon className="voice-mic__icon" />
          ) : (
            <MicIcon className="voice-mic__icon" />
          )}
        </button>

        <div className="voice-copy">
          <p className="voice-prompt" aria-hidden="true">
            {prompt}
          </p>
          <p className="voice-hint" aria-hidden="true">
            {hint}
          </p>
        </div>
      </div>

      <footer className="voice-footer">
        <span>COORDINACIÓN DE EMPLEABILIDAD · RED ALUMNI</span>
        <span>UNIFRANZ</span>
      </footer>
    </main>
  )
}
