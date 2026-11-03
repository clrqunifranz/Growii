import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  AlmaSpeechRecognition,
  AlmaSpeechRecognitionErrorEvent,
  AlmaSpeechRecognitionEvent,
  AlmaSpeechWindow,
} from '../types/speech'

const DEFAULT_LANGUAGE = 'es-BO'
const FALLBACK_LANGUAGE = 'es-ES'

interface SpeechRecognitionOptions {
  onText?: (text: string) => void
  onEnd?: () => void
}

function friendlyRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No se concedió permiso para usar el micrófono.'
    case 'no-speech':
      return 'No te escuché. Intenta nuevamente.'
    case 'audio-capture':
      return 'No se encontró un micrófono disponible.'
    case 'network':
      return 'El reconocimiento de voz necesita conexión a internet.'
    case 'language-not-supported':
      return 'El navegador no admite el idioma solicitado para el dictado.'
    case 'aborted':
      return 'El reconocimiento se canceló. Intenta nuevamente.'
    default:
      return 'No se pudo iniciar el reconocimiento de voz.'
  }
}

export function useSpeechRecognition({
  onText,
  onEnd,
}: SpeechRecognitionOptions = {}) {
  const [isSupported, setIsSupported] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<AlmaSpeechRecognition | null>(null)
  const isListeningRef = useRef(false)
  const onTextRef = useRef(onText)
  const onEndRef = useRef(onEnd)
  const languageRef = useRef(DEFAULT_LANGUAGE)
  const ignoreResultsRef = useRef(false)

  useEffect(() => {
    onTextRef.current = onText
    onEndRef.current = onEnd
  }, [onEnd, onText])

  useEffect(() => {
    const speechWindow = window as AlmaSpeechWindow
    const RecognitionConstructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    const secureContext = typeof window !== 'undefined' && window.isSecureContext
    const mediaDevices = navigator.mediaDevices
    const hasAudioDevices =
      !!mediaDevices && typeof mediaDevices.getUserMedia === 'function'

    if (!RecognitionConstructor) {
      console.debug('[ALMA] Reconocimiento de voz no disponible en este navegador.')
      setIsSupported(false)
      return
    }

    if (!secureContext) {
      console.debug('[ALMA] Reconocimiento de voz bloqueado: contexto no seguro.')
      setIsSupported(false)
      return
    }

    if (!hasAudioDevices) {
      console.debug('[ALMA] Reconocimiento de voz bloqueado: micrófono no detectable.')
      setIsSupported(false)
      return
    }

    setIsSupported(true)

    const recognition = new RecognitionConstructor()
    recognition.lang = languageRef.current
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      ignoreResultsRef.current = false
      isListeningRef.current = true
      setIsListening(true)
      setError(null)
      console.debug('[ALMA] Reconocimiento iniciado.')
    }

    recognition.onend = () => {
      isListeningRef.current = false
      setIsListening(false)
      console.debug('[ALMA] Reconocimiento finalizado.')
      onEndRef.current?.()
    }

    recognition.onresult = (event: AlmaSpeechRecognitionEvent) => {
      if (ignoreResultsRef.current) return

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

      const cleanText = finalText.replace(/\s+/g, ' ').trim()

      if (!cleanText) {
        console.debug('[ALMA] Resultado recibido sin una frase final.')
        return
      }

      console.debug('[ALMA] Resultado final recibido.')
      onTextRef.current?.(cleanText)
    }

    recognition.onerror = (event: AlmaSpeechRecognitionErrorEvent) => {
      isListeningRef.current = false
      setIsListening(false)
      console.debug(`[ALMA] Error de reconocimiento: ${event.error || 'desconocido'}.`)

      if (event.error === 'aborted') return

      if (event.error === 'language-not-supported') {
        languageRef.current = FALLBACK_LANGUAGE
        recognition.lang = FALLBACK_LANGUAGE
        setError(
          'El navegador no admite es-BO. Vuelve a pulsar el micrófono; se usará español estándar.',
        )
        return
      }

      setError(friendlyRecognitionError(event.error))
    }

    recognitionRef.current = recognition

    return () => {
      recognition.onstart = null
      recognition.onend = null
      recognition.onresult = null
      recognition.onerror = null
      recognition.abort()
      recognitionRef.current = null
      isListeningRef.current = false
    }
  }, [])

  const start = useCallback(() => {
    const recognition = recognitionRef.current

    if (!isSupported) {
      setError(
        'El reconocimiento de voz no está disponible en este navegador. Usa el modo TEXTO.',
      )
      console.debug('[ALMA] Intento de inicio sin soporte detectado.')
      return
    }

    if (!recognition || isListeningRef.current) return

    console.debug('[ALMA] Solicitando permiso de micrófono.')
    isListeningRef.current = false
    setError(null)
    ignoreResultsRef.current = false
    recognition.lang = languageRef.current

    try {
      recognition.start()
    } catch {
      isListeningRef.current = false
      setIsListening(false)
      console.debug('[ALMA] No se pudo iniciar el reconocimiento.')
      setError('No se pudo iniciar el micrófono. Intenta nuevamente.')
    }
  }, [isSupported])

  const stop = useCallback((discardResults = false) => {
    ignoreResultsRef.current = discardResults

    if (recognitionRef.current) {
      console.debug('[ALMA] Detención manual del reconocimiento.')
      recognitionRef.current.stop()
      return
    }

    console.debug('[ALMA] No había un reconocimiento activo para detener.')
  }, [])

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
    error,
    start,
    stop,
    toggle,
    clearError,
  }
}
