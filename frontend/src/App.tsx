import { useEffect, useRef, useState } from 'react'
import './styles/growii.css'
import './styles/growii-details.css'
import { GrowiiOwl } from './components/GrowiiOwl'
import { ChatScreen } from './components/ChatScreen'
import { MonitorScreen } from './components/MonitorScreen'
import { useConversation } from './hooks/useConversation'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { inferProfile } from './utils/profileInference'
import { logEvent } from './utils/telemetry'
import { useWakeWordVoice } from './hooks/useWakeWordVoice'
import type { GrowiiStatus } from './types/growii'
import type { ProfileId } from './types/chat'

type Screen = 'owl' | 'chat' | 'monitor'

const STATUS_LABEL: Record<GrowiiStatus, string> = {
  greeting: 'Hola',
  idle: 'Reposo',
  listening: 'Escuchando',
  thinking: 'Pensando',
  speaking: 'Hablando',
  error: 'Error',
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('owl')
  const [profile, setProfile] = useState<ProfileId | null>(null)
  const [greeting, setGreeting] = useState(true)
  const [voiceDraft, setVoiceDraft] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)

  const conversation = useConversation()
  const synthesis = useSpeechSynthesis()
  const recognition = useSpeechRecognition({
    onText: (text) =>
      setVoiceDraft((current) =>
        current.trim() ? `${current.trimEnd()} ${text}` : text,
      ),
  })

  // Saludo breve solo al montar.
  useEffect(() => {
    const timer = window.setTimeout(() => setGreeting(false), 1700)
    return () => window.clearTimeout(timer)
  }, [])

  // Micrófono ocupado mientras Growii piensa o habla (anti-eco).
  const busyRef = useRef(false)
  busyRef.current = synthesis.isSpeaking || conversation.isThinking

  // Escucha continua con wake word — vía principal de interacción.
  const voiceTotem = useWakeWordVoice({
    enabled: screen === 'owl',
    busyRef,
    onCommand: (text) => {
      void conversation.ask(text)
    },
  })

  // "Growii" a secas → Growii responde por voz pidiendo la orden.
  const lastAwakeRef = useRef(false)
  useEffect(() => {
    const isAwake = voiceTotem.state === 'awake'
    if (isAwake && !lastAwakeRef.current) {
      synthesis.speak('¿Dime?')
    }
    lastAwakeRef.current = isAwake
  }, [voiceTotem.state, synthesis])

  // Inferencia heurística de perfil a partir de los mensajes del visitante.
  // Solo actúa si el perfil aún no está identificado; nunca por un
  // saludo genérico (empate o cero coincidencias => null).
  useEffect(() => {
    if (profile !== null) return

    for (const message of conversation.messages) {
      if (message.role !== 'user') continue
      const guess = inferProfile(message.content)
      if (guess.profile) {
        setProfile(guess.profile)
        logEvent(
          'profile',
          `Perfil detectado: ${guess.profile} (score ${JSON.stringify(guess.score)})`,
        )
        break
      }
    }
  }, [conversation.messages, profile])

  // Reproducir en voz alta cada respuesta nueva del asistente.
  const lastSpokenIdRef = useRef<string | null>(null)
  useEffect(() => {
    const last = conversation.messages[conversation.messages.length - 1]
    if (!last || last.role !== 'assistant') return
    if (lastSpokenIdRef.current === last.id) return
    lastSpokenIdRef.current = last.id
    if (autoSpeak) synthesis.speak(last.content)
  }, [conversation.messages, autoSpeak, synthesis])

  // Cortar la voz solo al desmontar la app.
  const synthesisCancelRef = useRef(synthesis.cancel)
  synthesisCancelRef.current = synthesis.cancel
  useEffect(() => () => synthesisCancelRef.current(), [])

  const hasError = Boolean(
    conversation.error || recognition.error || synthesis.error || voiceTotem.error,
  )

  const status: GrowiiStatus = synthesis.isSpeaking
    ? 'speaking'
    : conversation.isThinking
      ? 'thinking'
      : recognition.isListening || voiceTotem.state === 'awake'
        ? 'listening'
        : hasError
          ? 'error'
          : greeting && screen === 'owl'
            ? 'greeting'
            : 'idle'

  const handleRestart = () => {
    synthesis.cancel()
    conversation.reset()
  }

  const handleGoHome = () => {
    synthesis.cancel()
    conversation.reset()
    // Regreso al modo "solo búho": visitante potencialmente nuevo.
    setProfile(null)
    setScreen('owl')
  }

  const handleSetProfile = (next: ProfileId | null) => {
    setProfile(next)
    logEvent(
      'profile',
      next ? `Perfil fijado manualmente: ${next}` : 'Perfil borrado manualmente',
    )
  }

  return (
    <main
      className={`gw${screen !== 'owl' ? ' gw--panel-open' : ''}`}
      data-status={status}
    >
      <header className="gw-topbar">
        <img
          className="gw-topbar__logo"
          src="/assets/growii/unifranz-logo.png"
          alt="Universidad Privada Franz Tamayo — UNIFRANZ"
          decoding="async"
          draggable={false}
        />
        <span className="gw-topbar__trail">
          <span className="gw-topbar__mark" aria-hidden="true" />
          Red Alumni
        </span>
      </header>

      <div className="gw-body">
        <section className="gw-stage" aria-label="Growii, el búho asistente">
          <button
            type="button"
            className="gw-stagehit"
            aria-label="Reactivar la escucha de Growii"
            title="Reactivar la escucha"
            onClick={voiceTotem.rearm}
          />
          <div className="gw-stage__frame">
            <span className="gw-stage__tag" data-status={status}>
              Growii ·{' '}
              {screen === 'owl' && status === 'idle'
                ? 'En escucha'
                : STATUS_LABEL[status]}
            </span>
            <GrowiiOwl
              className="gw-owl"
              status={status}
              speechText={synthesis.isSpeaking ? synthesis.lastSpokenText : null}
            />
          </div>

          {screen === 'owl' && (
            <div
              className={`gw-voicehint${
                voiceTotem.state === 'awake' ? ' is-awake' : ''
              }${voiceTotem.error ? ' is-error' : ''}`}
              role="status"
            >
              {voiceTotem.error ? (
                <>
                  <span className="gw-voicehint__text">
                    Voz no disponible: {voiceTotem.error}
                  </span>
                  <button
                    type="button"
                    className="gw-voicehint__retry"
                    onClick={voiceTotem.rearm}
                  >
                    Reintentar
                  </button>
                </>
              ) : voiceTotem.state === 'awake' ? (
                <>
                  <span className="gw-wave gw-wave--big" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="gw-voicehint__text">Te escucho…</span>
                </>
              ) : (
                <>
                  <span className="gw-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="gw-voicehint__text">
                    Habla con Growii — di «Groui»
                  </span>
                </>
              )}
            </div>
          )}
        </section>

        {screen !== 'owl' && (
          <div className="gw-screen">
            {screen === 'chat' && (
              <ChatScreen
                profile={profile}
                onSetProfile={handleSetProfile}
                conversation={conversation}
                voice={synthesis}
                recognition={recognition}
                voiceDraft={voiceDraft}
                onConsumeVoiceDraft={() => setVoiceDraft('')}
                autoSpeak={autoSpeak}
                onToggleAutoSpeak={() =>
                  setAutoSpeak((current) => {
                    if (current) synthesis.cancel()
                    return !current
                  })
                }
                onRestart={handleRestart}
                onGoHome={handleGoHome}
              />
            )}
            {screen === 'monitor' && (
              <MonitorScreen
                status={status}
                profile={profile}
                conversation={conversation}
                voiceName={synthesis.selectedVoiceName}
                onClose={() => setScreen('owl')}
              />
            )}
          </div>
        )}
      </div>

      <footer className="gw-bottombar">
        <span className="gw-bottombar__left">
          <button
            type="button"
            className={`gw-stealth${
              screen !== 'owl' ? ' gw-stealth--open' : ''
            }`}
            aria-pressed={screen === 'chat'}
            aria-label={
              screen === 'owl'
                ? 'Abrir el chat con Growii'
                : 'Ocultar el chat y volver al búho'
            }
            onClick={() => setScreen(screen === 'owl' ? 'chat' : 'owl')}
          >
            Chatear
          </button>
          <button
            type="button"
            className="gw-monitordot"
            aria-label="Panel interno de monitoreo"
            title="Monitoreo"
            onClick={() => setScreen('monitor')}
          >
            ···
          </button>
          <span>Coordinación de Empleabilidad · Red Alumni</span>
        </span>
        <span>Growii · 2026</span>
      </footer>
    </main>
  )
}
