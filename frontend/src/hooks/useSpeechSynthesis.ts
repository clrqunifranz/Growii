import { useCallback, useEffect, useState } from 'react'
import type { SpeechBoundary } from '../types/speech'
import { SPEECH_RATE } from '../utils/speechSchedule'

const VOICE_PREFERENCES = ['es-BO', 'es-419', 'es-MX', 'es-US', 'es-ES']

/** Pistas de voces masculinas en español (Windows, macOS, Chrome/Google). */
const MALE_HINTS = [
  'pablo',
  'raul',
  'raúl',
  'jorge',
  'gonzalo',
  'tomas',
  'tomás',
  'alvaro',
  'álvaro',
  'miguel',
  'enrique',
  'daniel',
  'male',
  'hombre',
]

function isMaleVoiceName(name: string): boolean {
  const normalized = name.toLowerCase()
  return MALE_HINTS.some((hint) => normalized.includes(hint))
}

interface VoiceChoice {
  voice: SpeechSynthesisVoice
  male: boolean
}

function chooseSpanishVoice(
  voices: SpeechSynthesisVoice[],
): VoiceChoice | null {
  const spanish = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('es'),
  )

  if (spanish.length === 0) return null

  const male = spanish.filter((voice) => isMaleVoiceName(voice.name))

  // 1) Voz masculina con el idioma preferido.
  for (const language of VOICE_PREFERENCES) {
    const match = male.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase(),
    )
    if (match) return { voice: match, male: true }
  }

  // 2) Cualquier masculina en español.
  if (male.length > 0) return { voice: male[0], male: true }

  // 3) Sin masculina instalada: la preferida disponible (se baja el tono).
  for (const language of VOICE_PREFERENCES) {
    const match = spanish.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase(),
    )
    if (match) return { voice: match, male: false }
  }

  return { voice: spanish[0], male: false }
}

export function useSpeechSynthesis() {
  const [isSupported] = useState(
    () =>
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      'SpeechSynthesisUtterance' in window,
  )
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  /** Última palabra alcanzada por el motor TTS (evento onboundary). */
  const [boundary, setBoundary] = useState<SpeechBoundary | null>(null)

  useEffect(() => {
    if (!isSupported) return

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices())
    }

    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      window.speechSynthesis.cancel()
    }
  }, [isSupported])

  const cleanTextForSpeech = useCallback((text: string): string => {
    let cleaned = text
    cleaned = cleaned.replace(/\[Respuesta incompleta:[^\]]*\]/gi, '')
    cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '')
    cleaned = cleaned.replace(/`([^`]+)`/g, '$1')
    cleaned = cleaned.replace(/^\s*#{1,6}\s+/gm, '')
    cleaned = cleaned.replace(/^\s*>\s+/gm, '')
    cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '')
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '')
    cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
    cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1')
    cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
    cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
    cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1')
    cleaned = cleaned.replace(/[\*_`#>\-\+\[\]\(\)\!]/g, ' ')
    cleaned = cleaned.replace(/\s+/g, ' ')
    return cleaned.trim()
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        console.debug('[ALMA] Reproducción de voz no disponible en este navegador.')
        return
      }

      const rawClean = text.trim()
      if (!rawClean) return
      const cleanText = cleanTextForSpeech(rawClean)
      if (!cleanText) return

      console.debug(`[ALMA] Reproducción solicitada: ${cleanText.length} caracteres.`)

      window.speechSynthesis.cancel()
      setBoundary(null)

      const utterance = new SpeechSynthesisUtterance(cleanText)
      const choice = chooseSpanishVoice(voices)

      if (choice) {
        console.debug(
          `[ALMA] Voz seleccionada: ${choice.voice.name} (${choice.male ? 'masculina' : 'femenina; se baja el tono'}).`,
        )
        utterance.voice = choice.voice
        utterance.lang = choice.voice.lang
        // Timbre grave y cálido. Si no hay voz masculina instalada,
        // se baja aún más para acercar el resultado.
        utterance.pitch = choice.male ? 0.78 : 0.65

        if (!choice.male) {
          console.debug(
            '[ALMA] Para voz de hombre real: instala una voz masculina en español (Configuración > Hora e idioma > Voz > Agregar voces).',
          )
        }
      } else {
        console.debug('[ALMA] Voz española no disponible; se usa la voz predeterminada.')
        utterance.lang = 'es-BO'
        utterance.pitch = 0.65
      }

      // Habla pausada y clara; speechSchedule.ts usa la misma constante
      // para programar la boca (más pausas = secuencias más controladas).
      utterance.rate = SPEECH_RATE
      utterance.volume = 1

      // El motor TTS dispara un evento por palabra (con índice de carácter).
      // El avatar lo usa para sincronizar (a grosso modo) su boca.
      // Tipado estructural: no todos los DOM lib lo declaran.
      const withBoundary = utterance as SpeechSynthesisUtterance & {
        onboundary: ((event: { charIndex?: number }) => void) | null
      }
      withBoundary.onboundary = (event) => {
        setBoundary({ charIndex: event.charIndex ?? 0, at: Date.now() })
      }

      utterance.onstart = () => {
        console.debug('[ALMA] Reproducción de voz iniciada.')
        setIsSpeaking(true)
        setError(null)
      }
      utterance.onend = () => {
        console.debug('[ALMA] Reproducción de voz finalizada.')
        setBoundary(null)
        setIsSpeaking(false)
      }
      utterance.onerror = (event) => {
        console.debug(`[ALMA] Error al reproducir la voz: ${event.error || 'desconocido'}.`)
        setBoundary(null)
        setIsSpeaking(false)

        if (event.error !== 'canceled' && event.error !== 'interrupted') {
          setError('No se pudo reproducir la voz en este navegador.')
        }
      }

      window.speechSynthesis.speak(utterance)
    },
    [isSupported, voices],
  )

  const cancel = useCallback(() => {
    if (!isSupported) return
    console.debug('[ALMA] Reproducción cancelada.')
    window.speechSynthesis.cancel()
    setBoundary(null)
    setIsSpeaking(false)
  }, [isSupported])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    isSupported,
    isSpeaking,
    error,
    speak,
    cancel,
    clearError,
    boundary,
  }
}
