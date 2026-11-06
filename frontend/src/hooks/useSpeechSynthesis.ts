import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SpeechBoundary } from '../types/speech'
import { SPEECH_RATE } from '../utils/speechSchedule'
import { logEvent } from '../utils/telemetry'

/**
 * Orden de preferencia de variantes de español. La primera que exista
 * se usa como desempate entre voces de calidad similar.
 */
const VOICE_PREFERENCES = ['es-BO', 'es-419', 'es-MX', 'es-US', 'es-ES']

/**
 * Tamaño máximo de cada fragmento enviado al motor TTS. Chrome corta
 * las locuciones largas (~15 s); dividir por frases evita que la voz
 * se detenga a mitad de una respuesta.
 */
const MAX_CHUNK_LENGTH = 180

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
]

function isFemaleVoiceName(name: string): boolean {
  const normalized = name.toLowerCase()
  return FEMALE_HINTS.some((hint) => normalized.includes(hint))
}

interface VoiceChoice {
  voice: SpeechSynthesisVoice
}

/**
 * Puntúa una voz española. El orden de prioridad solicitado es:
 * 1) Google en español, 2) voces neuronales/naturales (Edge), 3) la
 * variante de español más cercana y 4) timbre femenino.
 * No se inventan nombres: solo se puntúa lo que devuelve el navegador.
 */
function voiceQuality(voice: SpeechSynthesisVoice): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase()
  let score = 0

  if (name.includes('google')) score += 100
  if (name.includes('natural')) score += 50
  if (name.includes('online')) score += 20

  const localeIndex = VOICE_PREFERENCES.findIndex(
    (language) => language.toLowerCase() === lang,
  )
  score += localeIndex >= 0 ? (VOICE_PREFERENCES.length - localeIndex) * 2 : 1

  if (isFemaleVoiceName(name)) score += 3

  return score
}

/** Elige la voz española de mayor calidad realmente disponible. */
function chooseSpanishVoice(
  voices: SpeechSynthesisVoice[],
): VoiceChoice | null {
  const spanish = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith('es'),
  )

  if (spanish.length === 0) return null

  const [best] = [...spanish].sort(
    (a, b) => voiceQuality(b) - voiceQuality(a),
  )

  return best ? { voice: best } : null
}

/**
 * Divide el texto en fragmentos que el motor pueda pronunciar seguidos
 * sin superar el límite de Chrome y sin cortar palabras.
 */
export function splitForSpeech(text: string): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]*/g) ?? [text]
  const chunks: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current.trim()) chunks.push(current.trim())
    current = ''
  }

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim()
    if (!sentence) continue

    if (sentence.length > MAX_CHUNK_LENGTH) {
      pushCurrent()
      const words = sentence.split(/\s+/)
      let part = ''
      for (const word of words) {
        const candidate = part ? `${part} ${word}` : word
        if (candidate.length > MAX_CHUNK_LENGTH && part) {
          chunks.push(part)
          part = word
        } else {
          part = candidate
        }
      }
      if (part.trim()) chunks.push(part.trim())
      continue
    }

    const candidate = current ? `${current} ${sentence}` : sentence
    if (candidate.length > MAX_CHUNK_LENGTH) {
      pushCurrent()
      current = sentence
    } else {
      current = candidate
    }
  }

  pushCurrent()
  return chunks
}

export function cleanTextForSpeech(text: string): string {
  let cleaned = text

  // Markdown, enlaces, código y anotaciones internas.
  cleaned = cleaned.replace(/\[Respuesta incompleta:[^\]]*\]/gi, '')
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '')
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1')
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, ' ')
  cleaned = cleaned.replace(/^\s*#{1,6}\s+/gm, '')
  cleaned = cleaned.replace(/^\s*>\s+/gm, '')
  cleaned = cleaned.replace(/^\s*[-*+]\s+/gm, '')
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '')
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1')
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1')
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1')
  cleaned = cleaned.replace(/_([^_]+)_/g, '$1')
  cleaned = cleaned.replace(/~~([^~]+)~~/g, '$1')
  cleaned = cleaned.replace(/[\*_`#>\-\[\]\(\)]/g, ' ')
  cleaned = cleaned.replace(/\|/g, ' ')

  // Emojis, pictogramas, banderas, selectores de variación y ZWJ.
  // Evita que el motor lea «carita feliz» u otros nombres de emoji.
  cleaned = cleaned.replace(/\p{Extended_Pictographic}/gu, ' ')
  cleaned = cleaned.replace(
    /[\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}\u{FE0F}\u{20E3}\u{200D}]/gu,
    ' ',
  )
  cleaned = cleaned.replace(/[\u2190-\u21FF\u2300-\u23FF]/g, ' ')
  cleaned = cleaned.replace(/[\u25A0-\u25FF\u2B00-\u2BFF]/g, ' ')
  cleaned = cleaned.replace(/[\u2022\u00B7\u25CF]/g, ' ')
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')

  for (const [pattern, replacement] of PRONUNCIATION_MAP) {
    cleaned = cleaned.replace(pattern, replacement)
  }

  cleaned = cleaned.replace(/\s+([,.;:!?])/g, '$1')
  cleaned = cleaned.replace(/([,.;:])\1+/g, '$1')
  cleaned = cleaned.replace(/\s+/g, ' ')
  return cleaned.trim()
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
  /** Fragmento de texto (limpio) que el avatar usa para mover la boca. */
  const [lastSpokenText, setLastSpokenText] = useState<string | null>(null)

  const voicesRef = useRef<SpeechSynthesisVoice[]>([])
  /** Identifica la locución vigente; invalida callbacks de locuciones viejas. */
  const generationRef = useRef(0)
  const timersRef = useRef<number[]>([])

  const selectedVoice = useMemo(() => chooseSpanishVoice(voices), [voices])

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) {
      window.clearTimeout(timer)
    }
    timersRef.current = []
  }, [])

  // Carga de voces: el navegador puede poblarlas después del primer render.
  // Se escucha `voiceschanged` y se reintenta durante un instante por si
  // Chrome tarda en exponer las voces de Google.
  useEffect(() => {
    if (!isSupported) return

    const synth = window.speechSynthesis
    let cancelled = false
    let attempts = 0
    let retryTimer: number | null = null

    const loadVoices = () => {
      if (cancelled) return
      const available = synth.getVoices()
      if (available.length > 0) {
        voicesRef.current = available
        setVoices(available)
        const choice = chooseSpanishVoice(available)
        console.debug(
          choice
            ? `[GROWII] Voz TTS seleccionada: ${choice.voice.name} (${choice.voice.lang}).`
            : '[GROWII] No hay voces en español disponibles; se usará la predeterminada.',
        )
        return
      }

      if (attempts < 12) {
        attempts += 1
        retryTimer = window.setTimeout(loadVoices, 250)
      }
    }

    loadVoices()
    synth.addEventListener('voiceschanged', loadVoices)

    return () => {
      cancelled = true
      if (retryTimer) window.clearTimeout(retryTimer)
      synth.removeEventListener('voiceschanged', loadVoices)
      synth.cancel()
    }
  }, [isSupported])

  const cancel = useCallback(() => {
    generationRef.current += 1
    clearTimers()
    if (isSupported) {
      window.speechSynthesis.cancel()
    }
    setBoundary(null)
    setIsSpeaking(false)
    setLastSpokenText(null)
  }, [clearTimers, isSupported])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        console.debug('[GROWII] Reproducción de voz no disponible en este navegador.')
        return
      }

      const cleanText = cleanTextForSpeech(text)
      if (!cleanText) return

      const chunks = splitForSpeech(cleanText)
      if (chunks.length === 0) return

      // Nueva locución: invalida por completo la anterior para que no se
      // superpongan respuestas ni se repita una respuesta ya cancelada.
      const generation = generationRef.current + 1
      generationRef.current = generation
      clearTimers()

      const synth = window.speechSynthesis
      synth.cancel()
      setIsSpeaking(false)
      setBoundary(null)
      setError(null)
      logEvent(
        'voice',
        `Reproducción solicitada (${cleanText.length} caracteres, ${chunks.length} fragmentos)`,
      )
      console.debug(
        `[GROWII] Reproducción solicitada: ${cleanText.length} caracteres en ${chunks.length} fragmentos.`,
      )

      // Voz elegida con la lista más reciente; si aún no llegó el evento
      // `voiceschanged`, se consulta de nuevo en el momento de hablar.
      const availableVoices =
        voicesRef.current.length > 0 ? voicesRef.current : synth.getVoices()
      const choice = chooseSpanishVoice(availableVoices)

      if (choice) {
        console.debug(
          `[GROWII] Voz seleccionada: ${choice.voice.name} (${choice.voice.lang}).`,
        )
        logEvent('voice', `Voz: ${choice.voice.name} (${choice.voice.lang})`)
      } else {
        console.debug(
          '[GROWII] Voz española no disponible; se usa la voz predeterminada.',
        )
      }

      let index = 0

      const speakChunk = () => {
        if (generation !== generationRef.current) return

        const chunk = chunks[index]
        if (!chunk) {
          setIsSpeaking(false)
          setBoundary(null)
          return
        }

        setLastSpokenText(chunk)

        const utterance = new SpeechSynthesisUtterance(chunk)
        if (choice) {
          utterance.voice = choice.voice
          utterance.lang = choice.voice.lang
        } else {
          utterance.lang = 'es-BO'
        }

        // Habla pausada y clara; speechSchedule.ts usa la misma constante
        // para programar la boca (más pausas = secuencias más controladas).
        utterance.rate = SPEECH_RATE
        utterance.pitch = 1
        utterance.volume = 1

        // El motor TTS dispara un evento por palabra (con índice de carácter).
        // El avatar lo usa para sincronizar (a grosso modo) su boca.
        const withBoundary = utterance as SpeechSynthesisUtterance & {
          onboundary: ((event: { charIndex?: number }) => void) | null
        }
        withBoundary.onboundary = (event) => {
          if (generation !== generationRef.current) return
          setBoundary({ charIndex: event.charIndex ?? 0, at: Date.now() })
        }

        utterance.onstart = () => {
          if (generation !== generationRef.current) return
          console.debug('[GROWII] Reproducción de voz iniciada.')
          logEvent('voice', 'Reproducción iniciada')
          setIsSpeaking(true)
          setError(null)
        }

        utterance.onend = () => {
          if (generation !== generationRef.current) return
          index += 1
          if (index < chunks.length) {
            speakChunk()
            return
          }
          console.debug('[GROWII] Reproducción de voz finalizada.')
          logEvent('voice', 'Reproducción finalizada')
          setBoundary(null)
          setIsSpeaking(false)
        }

        utterance.onerror = (event) => {
          if (generation !== generationRef.current) return
          console.debug(
            `[GROWII] Error al reproducir la voz: ${event.error || 'desconocido'}.`,
          )
          logEvent('error', `Voz: ${event.error || 'desconocido'}`, false)
          setBoundary(null)
          setIsSpeaking(false)

          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            setError('No se pudo reproducir la voz en este navegador.')
          }
        }

        try {
          synth.speak(utterance)
        } catch {
          setIsSpeaking(false)
          setError('No se pudo reproducir la voz en este navegador.')
        }
      }

      // Chrome necesita un instante después de `cancel()`; además, si el
      // motor quedó en pausa (pestaña en segundo plano), se reanuda.
      const startTimer = window.setTimeout(() => {
        if (generation !== generationRef.current) return
        synth.resume()
        speakChunk()
      }, 80)
      timersRef.current.push(startTimer)
    },
    [cleanTextForSpeech, clearTimers, isSupported],
  )

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
    selectedVoiceName: selectedVoice?.voice.name ?? null,
    availableSpanishVoices: voices
      .filter((voice) => voice.lang.toLowerCase().startsWith('es'))
      .map((voice) => `${voice.name} (${voice.lang})`),
  }
}
