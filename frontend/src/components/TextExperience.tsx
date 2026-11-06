import { useCallback, useEffect, useRef, useState } from 'react'
import type { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import type { useConversation } from '../hooks/useConversation'
import { Avatar } from './Avatar'
import { ChatPanel } from './ChatPanel'
import { Header } from './Header'
import { ProfileSelector } from './ProfileSelector'
import type { ChatStatus } from './StatusIndicators'
import { PROFILE_OPTIONS } from '../data/suggestedQuestions'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { explainLikely } from '../utils/explain'
import type { ProfileId } from '../types/chat'
import type { PrismoSpeechVariant, PrismoStatus } from '../types/prismo'

type SpeechSynthesis = ReturnType<typeof useSpeechSynthesis>
type Conversation = ReturnType<typeof useConversation>

interface TextExperienceProps {
  conversation: Conversation
  synthesis: SpeechSynthesis
  demoMode: boolean
  onVoiceMode: () => void
  isVisible: boolean
}

export function TextExperience({
  conversation,
  synthesis,
  demoMode,
  onVoiceMode,
  isVisible,
}: TextExperienceProps) {
  const [profile, setProfile] = useState<ProfileId>('estudiante')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const lastSpokenIdRef = useRef<string | null>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    if (!isVisible) return

    const lastMessage = conversation.messages[conversation.messages.length - 1]

    if (!lastMessage || lastMessage.role !== 'assistant') return
    if (lastSpokenIdRef.current === lastMessage.id) return

    lastSpokenIdRef.current = lastMessage.id

    if (autoSpeak && synthesis.isSupported) {
      synthesis.speak(lastMessage.content)
    }
  }, [autoSpeak, conversation.messages, isVisible, synthesis.isSupported, synthesis.speak])

  const recognition = useSpeechRecognition({
    onText: (text) => {
      setInput((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text))
    },
  })

  // Al entrar: Prismo saluda ~1.5 s y transiciona suavemente al reposo.
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const timer = window.setTimeout(() => setEntering(false), 1500)
    return () => window.clearTimeout(timer)
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()

    if (!text || conversation.isThinking) return

    recognition.stop(true)
    synthesis.cancel()
    setInput('')

    const reply = await conversation.ask(text)

    if (reply && autoSpeak && synthesis.isSupported) {
      synthesis.speak(reply)
    }
  }, [autoSpeak, conversation, input, recognition, synthesis])

  const handleMicToggle = useCallback(() => {
    if (recognition.isListening) {
      recognition.stop()
      return
    }

    synthesis.cancel()
    recognition.toggle()
  }, [recognition, synthesis])

  const handleSuggestion = useCallback((question: string) => {
    setInput(question)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [])

  const handleToggleAutoSpeak = useCallback(() => {
    setAutoSpeak((current) => {
      const next = !current

      if (!next) {
        synthesis.cancel()
      }

      return next
    })
  }, [synthesis])

  const voiceNotice =
    [recognition.error, synthesis.error].filter(Boolean).join(' ') || null

  const dismissVoiceNotice = useCallback(() => {
    recognition.clearError()
    synthesis.clearError()
  }, [recognition, synthesis])

  const status: ChatStatus = conversation.isThinking
    ? 'thinking'
    : recognition.isListening
      ? 'listening'
      : synthesis.isSpeaking
        ? 'speaking'
        : 'idle'

  // La pose "explicando" se muestra solo al inicio de una respuesta
  // con pasos o recomendaciones; luego vuelve la animación de la boca.
  const lastAssistantReply = [...conversation.messages]
    .reverse()
    .find((message) => message.role === 'assistant')?.content
  const speechVariant: PrismoSpeechVariant =
    lastAssistantReply && explainLikely(lastAssistantReply) ? 'guide' : 'answer'
  const avatarStatus: PrismoStatus = entering ? 'greeting' : status

  return (
    <div className="app-shell">
      <Header demoMode={demoMode} onVoiceMode={onVoiceMode} />

      <main className="app-main">
        <aside className="alma-rail" aria-label="Presentación de ALMA">
          <Avatar
            status={avatarStatus}
            speechVariant={speechVariant}
            speechText={lastAssistantReply ?? null}
            boundary={synthesis.boundary}
          />

          <section className="alma-intro" aria-labelledby="intro-title">
            <p className="section-label">
              <span>PRESENTACIÓN</span>
              <span>ALMA</span>
            </p>
            <h2 id="intro-title">Hola, soy ALMA.</h2>
            <p>
              Oriento a estudiantes, Alumni y empresas de UNIFRANZ sobre
              empleabilidad, pasantías y Red Alumni.
            </p>
          </section>

          <ProfileSelector
            options={PROFILE_OPTIONS}
            selected={profile}
            onSelect={setProfile}
            onSuggestion={handleSuggestion}
          />
        </aside>

        <ChatPanel
          messages={conversation.messages}
          isLoading={conversation.isThinking}
          error={conversation.error}
          voiceNotice={voiceNotice}
          input={input}
          onInputChange={setInput}
          onSend={() => {
            void handleSend()
          }}
          onSpeak={synthesis.speak}
          onDismissError={conversation.clearError}
          onDismissVoiceNotice={dismissVoiceNotice}
          inputRef={inputRef}
          status={status}
          isListening={recognition.isListening}
          onMicToggle={handleMicToggle}
          recognitionSupported={recognition.isSupported}
          isSpeaking={synthesis.isSpeaking}
          onStopSpeaking={synthesis.cancel}
          synthesisSupported={synthesis.isSupported}
          autoSpeak={autoSpeak}
          onToggleAutoSpeak={handleToggleAutoSpeak}
        />
      </main>

      <footer className="app-footer">
        <span>COORDINACIÓN DE EMPLEABILIDAD · RED ALUMNI</span>
        <span>PROTOTIPO · 2026 · v0.1</span>
      </footer>
    </div>
  )
}
