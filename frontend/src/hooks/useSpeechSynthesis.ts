import { useCallback, useEffect, useState } from 'react'

const VOICE_PREFERENCES = ['es-BO', 'es-419', 'es-MX', 'es-US', 'es-ES']

function chooseSpanishVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  for (const language of VOICE_PREFERENCES) {
    const match = voices.find(
      (voice) => voice.lang.toLowerCase() === language.toLowerCase(),
    )
    if (match) return match
  }

  return voices.find((voice) => voice.lang.toLowerCase().startsWith('es')) ?? null
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

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) {
        console.debug('[ALMA] Reproducción de voz no disponible en este navegador.')
        return
      }

      const cleanText = text.trim()
      if (!cleanText) return

      console.debug(`[ALMA] Reproducción solicitada: ${cleanText.length} caracteres.`)

      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(cleanText)
      const voice = chooseSpanishVoice(voices)

      if (voice) {
        console.debug(`[ALMA] Voz seleccionada: ${voice.name}.`)
        utterance.voice = voice
        utterance.lang = voice.lang
      } else {
        console.debug('[ALMA] Voz española no disponible; se usa la voz predeterminada.')
        utterance.lang = 'es-BO'
      }

      utterance.rate = 1
      utterance.pitch = 1
      utterance.volume = 1

      utterance.onstart = () => {
        console.debug('[ALMA] Reproducción de voz iniciada.')
        setIsSpeaking(true)
        setError(null)
      }
      utterance.onend = () => {
        console.debug('[ALMA] Reproducción de voz finalizada.')
        setIsSpeaking(false)
      }
      utterance.onerror = (event) => {
        console.debug(`[ALMA] Error al reproducir la voz: ${event.error || 'desconocido'}.`)
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
  }
}
