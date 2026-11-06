import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  getEvents,
  clearEvents,
  logEvent,
} from '../utils/telemetry'
import { sendChatMessage } from '../services/chatApi'
import { DEMO_MODE } from '../services/chatApi'
import { PROFILE_LABEL } from '../data/quickActions'
import type { useConversation } from '../hooks/useConversation'
import type { GrowiiStatus } from '../types/growii'
import type { ProfileId } from '../types/chat'

type Conversation = ReturnType<typeof useConversation>

interface MonitorScreenProps {
  status: GrowiiStatus
  profile: ProfileId | null
  conversation: Conversation
  onClose: () => void
}

function timeStamp(at: number): string {
  return new Date(at).toLocaleTimeString('es-BO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/**
 * Panel interno de diagnóstico para el equipo. No es una pantalla pública.
 * Sin autenticación: pendiente coordinar con el responsable del backend.
 */
export function MonitorScreen({
  status,
  profile,
  conversation,
  onClose,
}: MonitorScreenProps) {
  const [testInput, setTestInput] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testOk, setTestOk] = useState<boolean | null>(null)
  const [testMs, setTestMs] = useState<number | null>(null)
  const [logVersion, setLogVersion] = useState(0)
  const [micPermission, setMicPermission] = useState('consultando…')
  const [spanishVoices, setSpanishVoices] = useState<string[]>([])

  const recognitionSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition,
    )

  useEffect(() => {
    const synth = window.speechSynthesis
    const loadVoices = () =>
      setSpanishVoices(
        synth
          .getVoices()
          .filter((voice) => voice.lang.toLowerCase().startsWith('es'))
          .slice(0, 8)
          .map((voice) => `${voice.name} (${voice.lang})`),
      )
    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)

    const permissions = navigator.permissions as
      | { query: (desc: { name: string }) => Promise<{ state: string }> }
      | undefined
    permissions
      ?.query({ name: 'microphone' })
      .then((status) => setMicPermission(status.state))
      .catch(() => setMicPermission('no consultable'))

    return () => synth.removeEventListener('voiceschanged', loadVoices)
  }, [])

  const events = useMemo(() => {
    void logVersion
    return [...getEvents()].reverse()
  }, [logVersion])

  const handleProbe = async (event: FormEvent) => {
    event.preventDefault()
    const text = testInput.trim()
    if (!text || isTesting) return

    setIsTesting(true)
    setTestResult(null)
    setTestOk(null)
    setTestMs(null)

    const started = performance.now()
    try {
      const result = await sendChatMessage({ message: text, history: [] })
      const elapsed = Math.round(performance.now() - started)
      setTestMs(elapsed)
      setTestOk(true)
      setTestResult(result.reply)
      logEvent(
        'system',
        `Prueba manual OK (${elapsed} ms): «${text.slice(0, 80)}»`,
      )
    } catch (error) {
      const elapsed = Math.round(performance.now() - started)
      setTestMs(elapsed)
      setTestOk(false)
      setTestResult(
        error instanceof Error ? error.message : 'Error desconocido',
      )
      logEvent(
        'error',
        `Prueba manual fallida: ${
          error instanceof Error ? error.message : 'error'
        }`,
        false,
      )
    } finally {
      setIsTesting(false)
      setLogVersion((version) => version + 1)
    }
  }

  return (
    <section className="gw-monitor" aria-label="Panel interno de monitoreo">
      <div className="gw-monitor__head">
        <div>
          <p className="gw-kicker">Uso interno del equipo</p>
          <h2 className="gw-monitor__title">Monitoreo</h2>
        </div>
        <button type="button" className="gw-chipbutton" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <div className="gw-monitor__grid">
        <div className="gw-monitor__cell">
          <span className="gw-monitor__label">Estado actual</span>
          <strong className="gw-monitor__value">{status.toUpperCase()}</strong>
        </div>
        <div className="gw-monitor__cell">
          <span className="gw-monitor__label">Perfil detectado</span>
          <strong className="gw-monitor__value">
            {profile ? PROFILE_LABEL[profile] : 'SIN DETECTAR'}
          </strong>
        </div>
        <div className="gw-monitor__cell">
          <span className="gw-monitor__label">Backend</span>
          <strong className="gw-monitor__value">
            {DEMO_MODE ? 'MODO MOCK' : import.meta.env.VITE_API_BASE_URL ? 'CONFIGURADO' : '—'}
          </strong>
        </div>
        <div className="gw-monitor__cell">
          <span className="gw-monitor__label">Mensajes en sesión</span>
          <strong className="gw-monitor__value">
            {conversation.messages.length}
          </strong>
        </div>
      </div>

      <div className="gw-monitor__block">
        <span className="gw-monitor__label">Diagnóstico de voz</span>
        <div className="gw-monitor__scroll gw-monitor__scroll--voice">
          <p className="gw-monitor__line">
            <span className="gw-monitor__who">RECONOCIMIENTO</span>
            {recognitionSupported ? 'disponible' : 'NO disponible en este navegador'}
          </p>
          <p className="gw-monitor__line">
            <span className="gw-monitor__who">PERMISO MIC</span>
            {micPermission}
          </p>
          <p className="gw-monitor__line">
            <span className="gw-monitor__who">AUTOPLAY</span>
            El navegador debe permitir voz sin gesto (flag --autoplay-policy=no-user-gesture-required o detectar gesto del visitante).
          </p>
          {spanishVoices.length === 0 ? (
            <p className="gw-monitor__line gw-monitor__line--fail">
              <span className="gw-monitor__who">VOCES ES</span>
              Ninguna voz en español detectada en este equipo
            </p>
          ) : (
            spanishVoices.map((voice) => (
              <p key={voice} className="gw-monitor__line">
                <span className="gw-monitor__who">VOZ ES</span>
                {voice}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="gw-monitor__block">
        <div className="gw-monitor__blockhead">
          <span className="gw-monitor__label">Conversación de la sesión</span>
        </div>
        <div className="gw-monitor__scroll">
          {conversation.messages.length === 0 ? (
            <p className="gw-monitor__empty">Aún no hay mensajes.</p>
          ) : (
            conversation.messages.map((message) => (
              <p key={message.id} className="gw-monitor__line">
                <span className="gw-monitor__who">
                  {message.role === 'user' ? 'USUARIO' : 'GROWII'}
                  {message.isDemo ? ' (mock)' : ''}
                </span>
                {message.content}
              </p>
            ))
          )}
        </div>
      </div>

      <div className="gw-monitor__block">
        <div className="gw-monitor__blockhead">
          <span className="gw-monitor__label">
            Eventos ({events.length})
          </span>
          <button
            type="button"
            className="gw-chipbutton"
            onClick={() => {
              clearEvents()
              setLogVersion((version) => version + 1)
            }}
          >
            Limpiar
          </button>
        </div>
        <div className="gw-monitor__scroll gw-monitor__scroll--events">
          {events.length === 0 ? (
            <p className="gw-monitor__empty">Sin eventos registrados.</p>
          ) : (
            events.map((item) => (
              <p
                key={item.id}
                className={`gw-monitor__line${
                  item.ok ? '' : ' gw-monitor__line--fail'
                }`}
              >
                <span className="gw-monitor__who">
                  {timeStamp(item.at)} · {item.kind.toUpperCase()}
                </span>
                {item.detail}
              </p>
            ))
          )}
        </div>
      </div>

      <form className="gw-monitor__block" onSubmit={handleProbe}>
        <span className="gw-monitor__label">
          Prueba manual (envía al backend)
        </span>
        <div className="gw-monitor__probe">
          <input
            type="text"
            className="gw-monitor__input"
            value={testInput}
            onChange={(event) => setTestInput(event.target.value)}
            placeholder="Escribe una petición de prueba…"
            aria-label="Petición de prueba para el backend"
            disabled={isTesting}
          />
          <button
            type="submit"
            className="gw-button gw-button--primary gw-monitor__send"
            disabled={isTesting || !testInput.trim()}
          >
            {isTesting ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
        {testResult !== null && (
          <div
            className={`gw-monitor__result${
              testOk ? '' : ' gw-monitor__result--fail'
            }`}
            role="status"
          >
            <span className="gw-monitor__who">
              {testOk ? 'OK' : 'ERROR'} {testMs !== null ? `· ${testMs} ms` : ''}
            </span>
            {testResult}
          </div>
        )}
      </form>

      <p className="gw-monitor__note">
        Panel sin autenticación. Pendiente coordinar protección con el
        responsable del backend. No se registran datos personales.
      </p>
    </section>
  )
}
