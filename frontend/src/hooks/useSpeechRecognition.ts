import { useCallback, useEffect, useRef, useState } from 'react'
import { logEvent } from '../utils/telemetry'
import type {
  GrowiiSpeechRecognition,
  GrowiiSpeechRecognitionErrorEvent,
  GrowiiSpeechRecognitionEvent,
  GrowiiSpeechWindow,
} from '../types/speech'

const DEFAULT_LANGUAGE = 'es-BO'
const FALLBACK_LANGUAGE = 'es-ES'

/** Silencio continuo tras el último resultado antes de cerrar la captura. */
const SILENCE_MS = 1800
/** Margen tras `onspeechend` para recibir el resultado final del motor. */
const SPEECH_END_GRACE_MS = 900
/** Respaldo por si el motor nunca dispara `onend`. */
const STOP_FALLBACK_MS = 1500
/** Texto mínimo para considerar un dictado válido. */
const MIN_TEXT_LENGTH = 2

interface SpeechRecognitionOptions {
  onText?: (text: string) => void
  onEnd?: () => void
}

interface DeliveredText {
  text: string
  at: number
}

function friendlyRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No se concedió permiso para usar el micrófono.'
    case 'no-speech':
      return 'No te escuché. Intenta hablar más cerca del micrófono.'
    case 'audio-capture':
      return 'No se encontró un micrófono disponible.'
    case 'network':
      return 'El reconocimiento de voz necesita conexión a internet.'
    case 'language-not-supported':
      return 'El navegador no admite es-BO. Vuelve a pulsar el micrófono; se usará español estándar.'
    case 'aborted':
      return 'El reconocimiento se canceló. Intenta nuevamente.'
    default:
      return 'No se pudo iniciar el reconocimiento de voz.'
  }
}

function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function useSpeechRecognition({
  onText,
  onEnd,
}: SpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<GrowiiSpeechRecognition | null>(null)
  const isListeningRef = useRef(false)
  const onTextRef = useRef(onText)
  const onEndRef = useRef(onEnd)
  const languageRef = useRef(DEFAULT_LANGUAGE)
  const ignoreResultsRef = useRef(false)

  /** Texto confirmado (resultados `isFinal`) de la captura actual. */
  const finalTextRef = useRef('')
  /** Texto provisional mostrado mientras el usuario habla. */
  const interimTextRef = useRef('')
  /** Evita finalizar/deduplicar dos veces la misma captura. */
  const finishedRef = useRef(true)
  const lastDeliveredRef = useRef<DeliveredText | null>(null)

  const silenceTimerRef = useRef<number | null>(null)
  const speechEndTimerRef = useRef<number | null>(null)
  const stopFallbackTimerRef = useRef<number | null>(null)

  useEffect(() => {
    onTextRef.current = onText
    onEndRef.current = onEnd
  }, [onEnd, onText])

  const clearSessionTimers = useCallback(() => {
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (speechEndTimerRef.current) {
      window.clearTimeout(speechEndTimerRef.current)
      speechEndTimerRef.current = null
    }
    if (stopFallbackTimerRef.current) {
      window.clearTimeout(stopFallbackTimerRef.current)
      stopFallbackTimerRef.current = null
    }
  }, [])

  const deliverText = useCallback((rawText: string) => {
    const text = normalizeTranscript(rawText)
    if (text.length < MIN_TEXT_LENGTH) return

    const now = Date.now()
    const previous = lastDeliveredRef.current
    if (
      previous &&
      previous.text.toLowerCase() === text.toLowerCase() &&
      now - previous.at < 3000
    ) {
      console.debug('[GROWII] Dictado duplicado ignorado.')
      return
    }

    lastDeliveredRef.current = { text, at: now }
    console.debug(`[GROWII] Dictado final: ${text.length} caracteres.`)
    logEvent('recognition', `Texto reconocido: «${text.slice(0, 120)}»`)
    onTextRef.current?.(text)
  }, [])

  /**
   * Cierra la captura una sola vez, entrega el texto acumulado y libera
   * el indicador de micrófono. Es idempotente: la llaman `onend`, los
   * errores y el temporizador de respaldo.
   */
  const finishSession = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    clearSessionTimers()
    isListeningRef.current = false
    setIsListening(false)

    const text = normalizeTranscript(
      finalTextRef.current || interimTextRef.current,
    )
    finalTextRef.current = ''
    interimTextRef.current = ''
    setInterimText('')

    if (!ignoreResultsRef.current) {
      deliverText(text)
    }

    logEvent('recognition', 'Dictado finalizado')
    console.debug('[GROWII] Reconocimiento finalizado.')
    onEndRef.current?.()
  }, [clearSessionTimers, deliverText])

  const requestStop = useCallback(
    (delayMs: number) => {
      if (silenceTimerRef.current) {
        window.clearTimeout(silenceTimerRef.current)
      }
      silenceTimerRef.current = window.setTimeout(() => {
        silenceTimerRef.current = null
        if (!isListeningRef.current) return
        if (!finalTextRef.current && !interimTextRef.current) return

        console.debug('[GROWII] Silencio detectado; cerrando captura.')
        try {
          recognitionRef.current?.stop()
        } catch {
          finishSession()
          return
        }

        // Si el motor no dispara `onend`, cerramos igualmente.
        stopFallbackTimerRef.current = window.setTimeout(() => {
          if (isListeningRef.current) finishSession()
        }, STOP_FALLBACK_MS)
      }, delayMs)
    },
    [finishSession],
  )

  useEffect(() => {
    const speechWindow = window as GrowiiSpeechWindow
    const RecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    const secureContext = typeof window !== 'undefined' && window.isSecureContext
    const mediaDevices = navigator.mediaDevices
    const hasAudioDevices =
      !!mediaDevices && typeof mediaDevices.getUserMedia === 'function'

    if (!RecognitionConstructor) {
      console.debug('[GROWII] Reconocimiento de voz no disponible en este navegador.')
      setIsSupported(false)
      return
    }

    if (!secureContext) {
      console.debug('[GROWII] Reconocimiento de voz bloqueado: contexto no seguro.')
      setIsSupported(false)
      return
    }

    if (!hasAudioDevices) {
      console.debug('[GROWII] Reconocimiento de voz bloqueado: micrófono no detectable.')
      setIsSupported(false)
      return
    }

    setIsSupported(true)

    const recognition = new RecognitionConstructor()
    recognition.lang = languageRef.current
    // `continuous` + detección propia de silencio: el motor no cierra la
    // captura en la primera pausa y nosotros decidimos cuándo terminó.
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      finishedRef.current = false
      ignoreResultsRef.current = false
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
      logEvent('recognition', 'Dictado iniciado')
      console.debug('[GROWII] Reconocimiento iniciado.')
    }

    recognition.onresult = (event: GrowiiSpeechRecognitionEvent) => {
      if (ignoreResultsRef.current || finishedRef.current) return

      let finalFragment = ''
      let interimFragment = ''

      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index]
        const transcript = result[0]?.transcript ?? ''
        if (result.isFinal) {
          finalFragment += ` ${transcript}`
        } else {
          interimFragment += ` ${transcript}`
        }
      }

      const finalClean = normalizeTranscript(finalFragment)
      if (finalClean) {
        finalTextRef.current = normalizeTranscript(
          `${finalTextRef.current} ${finalClean}`,
        )
        interimTextRef.current = ''
        setInterimText('')
      } else {
        interimTextRef.current = normalizeTranscript(interimFragment)
        setInterimText(interimTextRef.current)
      }

      if (finalTextRef.current || interimTextRef.current) {
        // Cada nuevo resultado reinicia el reloj de silencio.
        requestStop(SILENCE_MS)
      }
    }

    recognition.onspeechend = () => {
      if (!isListeningRef.current) return
      if (!finalTextRef.current && !interimTextRef.current) return
      // El motor ya detectó el final del habla: damos un margen breve
      // para recibir el resultado final y cerramos automáticamente.
      requestStop(SPEECH_END_GRACE_MS)
    }

    recognition.onerror = (event: GrowiiSpeechRecognitionErrorEvent) => {
      const code = event.error || 'desconocido'
      console.debug(`[GROWII] Error de reconocimiento: ${code}.`)
      logEvent('error', `Reconocimiento: ${code}`, false)

      if (code === 'aborted') {
        finishSession()
        return
      }

      // Un error invalida el texto parcial: no se envía nada a medias.
      ignoreResultsRef.current = true

      if (code === 'language-not-supported') {
        languageRef.current = FALLBACK_LANGUAGE
        recognition.lang = FALLBACK_LANGUAGE
      }

      setError(friendlyRecognitionError(code))
      finishSession()
    }

    recognition.onend = () => {
      finishSession()
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onstart = null
      recognition.onend = null
      recognition.onresult = null
      recognition.onspeechend = null
      recognition.onerror = null
      try {
        recognition.abort()
      } catch {
        /* ya detenido */
      }
      recognitionRef.current = null
      isListeningRef.current = false
      finishedRef.current = true
      clearSessionTimers()
    }
  }, [clearSessionTimers, finishSession, requestStop])

  const start = useCallback(() => {
    const recognition = recognitionRef.current

    if (!isSupported) {
      setError(
        'El reconocimiento de voz no está disponible en este navegador. Usa el modo TEXTO.',
      )
      console.debug('[GROWII] Intento de inicio sin soporte detectado.')
      return
    }

    if (!recognition || isListeningRef.current) return

    finalTextRef.current = ''
    interimTextRef.current = ''
    ignoreResultsRef.current = false
    finishedRef.current = false
    clearSessionTimers()
    setInterimText('')
    setError(null)

    recognition.lang = languageRef.current
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    console.debug('[GROWII] Iniciando dictado; se solicitará permiso de micrófono.')
    try {
      recognition.start()
    } catch {
      finishedRef.current = true
      isListeningRef.current = false
      setIsListening(false)
      console.debug('[GROWII] No se pudo iniciar el reconocimiento.')
      setError('No se pudo iniciar el micrófono. Intenta nuevamente.')
    }
  }, [clearSessionTimers, isSupported])

  const stop = useCallback(
    (discardResults = false) => {
      if (discardResults) ignoreResultsRef.current = true
      clearSessionTimers()

      const recognition = recognitionRef.current
      if (!recognition) {
        setIsListening(false)
        return
      }

      console.debug('[GROWII] Detención manual del reconocimiento.')
      try {
        recognition.stop()
      } catch {
        finishSession()
        return
      }

      stopFallbackTimerRef.current = window.setTimeout(() => {
        if (isListeningRef.current) finishSession()
      }, STOP_FALLBACK_MS)
    },
    [clearSessionTimers, finishSession],
  )

  const toggle = useCallback(() => {
    if (isListeningRef.current) {
      stop()
    } else {
      start()
    }
  }, [start, stop])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isSupported,
    isListening,
    interimText,
    error,
    start,
    stop,
    toggle,
    clearError,
  }
}
