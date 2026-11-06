import { useCallback, useEffect, useRef, useState } from 'react'
import { matchWakeWord, normalizeWakeText } from '../utils/wakeWord'
import { logEvent } from '../utils/telemetry'
import type {
  GrowiiSpeechRecognition,
  GrowiiSpeechWindow,
} from '../types/speech'

const LANGUAGE = 'es-BO'
const FALLBACK_LANGUAGE = 'es-ES'
/** Ventana para dictar el comando tras un "Growii" a secas. */
const AWAKE_WINDOW_MS = 12_000
/** Pausa tras un error antes de reintentar la escucha. */
const RETRY_MS = 900

export type VoiceTotemState = 'off' | 'armed' | 'awake'

interface UseWakeWordVoiceOptions {
  /** Activa la escucha continua (false la detiene del todo). */
  enabled: boolean
  /** true mientras Growii habla o procesa: el mic se silencia. */
  busyRef: React.MutableRefObject<boolean>
  /** Se invoca con el comando reconocido (p. ej. enviar al backend). */
  onCommand: (text: string) => void
}

/**
 * Escucha continua para tótem sin toque: escucha en reposo, detecta la
 * palabra de activación «Growii» (o «Oye Growii») y captura la orden.
 * Nada se envía al backend salvo tras detectar la wake word.
 * El mic se silencia mientras Growii habla para evitar eco.
 */
export function useWakeWordVoice({
  enabled,
  busyRef,
  onCommand,
}: UseWakeWordVoiceOptions) {
  const [supported, setSupported] = useState(false)
  const [state, setState] = useState<VoiceTotemState>('off')
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const recognitionRef = useRef<GrowiiSpeechRecognition | null>(null)
  const enabledRef = useRef(enabled)
  const busyRefLocal = busyRef
  const onCommandRef = useRef(onCommand)
  const languageRef = useRef(LANGUAGE)
  const awakeUntilRef = useRef(0)
  const restartTimerRef = useRef<number | null>(null)
  const stateRef = useRef<VoiceTotemState>('off')
  const noSpeechSeenRef = useRef(false)

  useEffect(() => {
    onCommandRef.current = onCommand
  }, [onCommand])

  const setTotemState = useCallback((next: VoiceTotemState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const stopRecognition = useCallback(() => {
    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current)
      restartTimerRef.current = null
    }
    const recognition = recognitionRef.current
    if (recognition) {
      recognition.onend = null
      try {
        recognition.abort()
      } catch {
        /* ya detenido */
      }
      recognitionRef.current = null
    }
    setTotemState(enabledRef.current ? 'armed' : 'off')
  }, [setTotemState])

  useEffect(() => {
    enabledRef.current = enabled

    const speechWindow = window as GrowiiSpeechWindow
    const RecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition

    if (!enabled) {
      stopRecognition()
      setSupported((current) => current) // sin cambios
      return
    }

    if (!RecognitionConstructor) {
      setSupported(false)
      setError(
        'Este navegador no ofrece reconocimiento de voz; usa el respaldo de chat.',
      )
      return
    }

    setSupported(true)

    const recognition = new RecognitionConstructor()
    recognition.lang = languageRef.current
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognitionRef.current = recognition

    recognition.onstart = () => {
      setError(null)
      setTotemState(stateRef.current === 'awake' ? 'awake' : 'armed')
    }

    recognition.onend = () => {
      // Reinicio automático mientras el tótem está habilitado.
      if (!enabledRef.current) {
        setTotemState('off')
        return
      }
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current)
      }
      restartTimerRef.current = window.setTimeout(() => {
        try {
          recognition.lang = languageRef.current
          recognition.start()
        } catch {
          /* ya estaba activo; el siguiente onend reintentará */
        }
      }, RETRY_MS)
    }

    recognition.onerror = (event) => {
      const code = event.error || 'desconocido'

      // Silencio: ocurre a menudo; lo reinicia onend sin ruido.
      if (code === 'no-speech') {
        if (!noSpeechSeenRef.current) {
          noSpeechSeenRef.current = true
          console.debug('[GROWII] Escucha continua en silencio (normal).')
        }
        return
      }

      if (code === 'aborted') return

      if (code === 'language-not-supported' && languageRef.current === LANGUAGE) {
        languageRef.current = FALLBACK_LANGUAGE
        recognition.lang = FALLBACK_LANGUAGE
        logEvent('error', 'es-BO no soportado; usando es-ES', false)
        return
      }

      if (code === 'not-allowed' || code === 'service-not-allowed') {
        enabledRef.current = false
        setError(
          'Permiso de micrófono denegado. Concédelo en el navegador del tótem.',
        )
        logEvent('error', 'Micrófono denegado por el navegador', false)
        setTotemState('off')
        return
      }

      if (code === 'audio-capture') {
        enabledRef.current = false
        setError('No se encontró un micrófono disponible en este equipo.')
        logEvent('error', 'Micrófono no detectado por el sistema', false)
        setTotemState('off')
        return
      }

      // Resto (network, etc.): se reporta y onend reintenta.
      logEvent('error', `Escucha continua: ${code}`, false)
      setError('La escucha por voz tuvo un problema; reintentando…')
    }

    recognition.onresult = (event) => {
      // Growii hablando/procesando: se ignoran los resultados (anti-eco).
      if (busyRefLocal.current) return

      let finalText = ''
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index]
        if (!result.isFinal) continue
        finalText += result[0]?.transcript ?? ''
      }

      const text = finalText.replace(/\s+/g, ' ').trim()
      if (!text) return

      const now = Date.now()
      logEvent('recognition', `Oído: «${normalizeWakeText(text).slice(0, 120)}»`)

      // Modo "despierto": la siguiente frase es el comando.
      if (stateRef.current === 'awake' && now < awakeUntilRef.current) {
        const command = normalizeWakeText(text)
        awakeUntilRef.current = 0
        setTotemState('armed')
        if (command.length >= 3) {
          logEvent('send', `Comando de voz: «${command.slice(0, 120)}»`)
          onCommandRef.current(command)
        }
        return
      }

      if (stateRef.current === 'awake') {
        // Expiró la ventana; se descarta.
        setTotemState('armed')
      }

      const match = matchWakeWord(text)
      if (!match) return

      logEvent('recognition', `Wake word detectada en «${text.slice(0, 80)}»`)

      if (match.command.length >= 3) {
        logEvent('send', `Comando de voz: «${match.command.slice(0, 120)}»`)
        onCommandRef.current(match.command)
        return
      }

      // "Growii" a secas: pedir la orden (sigue con mic activo pero
      // silenciado durante el habla, lo controla `busyRef`).
      setTotemState('awake')
      awakeUntilRef.current = now + AWAKE_WINDOW_MS
    }

    try {
      recognition.start()
      setTotemState('armed')
    } catch {
      setTotemState('off')
    }

    return () => {
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      try {
        recognition.abort()
      } catch {
        /* noop */
      }
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current)
        restartTimerRef.current = null
      }
      recognitionRef.current = null
      setTotemState('off')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attempt])

  /** Fuerza un reinicio limpio de la escucha (p. ej. tras conceder permisos). */
  const rearm = useCallback(() => {
    setError(null)
    enabledRef.current = true
    noSpeechSeenRef.current = false
    setAttempt((value) => value + 1)
    logEvent('recognition', 'Escucha reactivada por el usuario')
  }, [])

  // Expiración de la ventana "despierto" sin intervención.
  useEffect(() => {
    if (state !== 'awake') return
    const timer = window.setTimeout(() => {
      awakeUntilRef.current = 0
      setTotemState('armed')
      logEvent('recognition', 'Ventana de escucha expirada')
    }, AWAKE_WINDOW_MS + 400)
    return () => window.clearTimeout(timer)
  }, [state, setTotemState])

  return { supported, state, error, rearm }
}
