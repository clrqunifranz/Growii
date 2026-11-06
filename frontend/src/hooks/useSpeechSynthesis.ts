import { useCallback, useEffect, useState } from 'react'
import type { SpeechBoundary } from '../types/speech'
import { SPEECH_RATE } from '../utils/speechSchedule'
import { logEvent } from '../utils/telemetry'

const VOICE_PREFERENCES = ['es-BO', 'es-419', 'es-MX', 'es-US', 'es-ES']

/**
 * Reemplazos de pronunciación para el TTS: siglas, marcas y símbolos
 * que los motores leen mal en español. Se aplican sobre el texto ya
 * limpio de markdown, antes de crear el utterance.
 * OJO: el orden importa (UNIFRANZ antes que UNIFRANZ suelto, etc.).
 */
const PRONUNCIATION_MAP: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bUNIFRANZ\b/gi, 'Unifranz'],
  [/\bGROWII\b/gi, 'Groui'],
  [/\bRED\s+ALUMNI\b/gi, 'Red Alumni'],
  [/\bCV\b/g, 'ce uve'],
  [/\bRRHH\b/gi, 'erre erre hache hache'],
  [/\bTI\b/g, 'te i'],
  [/\bRRSS\b/gi, 'erre erre ese ese'],
  [/&/g, ' y '],
  [/%/g, ' por ciento '],
  [/@/g, ' arroba '],
]

/** Pistas de voces femeninas jóvenes en español (Windows, macOS, Chrome/Google). */
const FEMALE_HINTS = [
  'sofia',
  'sofía',
  'dalia',
  'sabina',
  'mónica',
  'monica',
  'helena',
  'elvira',
  'paola',
  'paloma',
  'valeria',
  'lucia',
  'lucía',
  'female',
  'mujer',
  'google español',
]

function isFemaleVoiceName(name: string): boolean {
  const normalized = name.toLowerCase()
  return FEMALE_HINTS.some((hint) => normalized.includes(hint))
}

interface VoiceChoice {
  voice: SpeechSynthesisVoice
  male: boolean
}

function voiceQuality(name: string): number {
  const n = name.toLowerCase()
  let score = 0
  if (n.includes('natural')) score += 3
  if (n.includes('online')) score += 2
  if (isFemaleVoiceName(n)) score += 2
  if (n.includes('google')) score += 1
  return score
}

function chooseSpanishVoice(
  voices: SpeechSynthesisVoice[],
): VoiceChoice | null {
  const spanish = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('es'),
  )

  if (spanish.length === 0) return null

  // Por cada idioma en orden de preferencia, elegir la voz de MAYOR
  // calidad (voces "Natural/Online" y femeninas puntúan más), nunca
  // la primera de la lista a ciegas.
  for (const language of VOICE_PREFERENCES) {
    const candidates = spanish
      .filter((voice) => voice.lang.toLowerCase() === language.toLowerCase())
      .sort((a, b) => voiceQuality(b.name) - voiceQuality(a.name))

    if (candidates.length > 0) {
      return { voice: candidates[0], male: false }
    }
  }

  const byQuality = [...spanish].sort(
    (a, b) => voiceQuality(b.name) - voiceQuality(a.name),
  )

  return { voice: byQuality[0], male: false }
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
  /** Texto (limpio) de la última respuesta solicitada al TTS. */
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null)

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
    for (const [pattern, replacement] of PRONUNCIATION_MAP) {
      cleaned = cleaned.replace(pattern, replacement)
    }
    cleaned = cleaned.replace(/\s+/g, ' ')
    return cleaned.trim()
  }, [])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        console.debug('[GROWII] Reproducción de voz no disponible en este navegador.')
        return
      }

      const rawClean = text.trim()
      if (!rawClean) return
      const cleanText = cleanTextForSpeech(rawClean)
      if (!cleanText) return
      setLastSpokenText(cleanText)
      logEvent('voice', `Reproducción solicitada (${cleanText.length} caracteres)`)

      console.debug(`[GROWII] Reproducción solicitada: ${cleanText.length} caracteres.`)

      window.speechSynthesis.cancel()
      setBoundary(null)

      const utterance = new SpeechSynthesisUtterance(cleanText)
      const choice = chooseSpanishVoice(voices)

      if (choice) {
        console.debug(
          `[GROWII] Voz seleccionada: ${choice.voice.name}.`,
        )
        utterance.voice = choice.voice
        utterance.lang = choice.voice.lang
        // Timbre joven y cálido, cercano al registro natural.
        utterance.pitch = 1.05
      } else {
        console.debug('[GROWII] Voz española no disponible; se usa la voz predeterminada.')
        utterance.lang = 'es-BO'
        utterance.pitch = 1.05
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
        console.debug('[GROWII] Reproducción de voz iniciada.')
        logEvent('voice', 'Reproducción iniciada')
        setIsSpeaking(true)
        setError(null)
      }
      utterance.onend = () => {
        console.debug('[GROWII] Reproducción de voz finalizada.')
        logEvent('voice', 'Reproducción finalizada')
        setBoundary(null)
        setIsSpeaking(false)
      }
      utterance.onerror = (event) => {
        console.debug(`[GROWII] Error al reproducir la voz: ${event.error || 'desconocido'}.`)
        logEvent('error', `Voz: ${event.error || 'desconocido'}`, false)
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
    console.debug('[GROWII] Reproducción cancelada.')
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
    cleanTextForSpeech,
    lastSpokenText,
  }
}
