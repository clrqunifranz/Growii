/**
 * Detección local de la palabra de activación "Growii" (y variante
 * "Oye Growii"), con tolerancia a errores fonéticos del motor de voz.
 * Coste cero: todo el análisis ocurre en el cliente, sin llamar al backend.
 */

const DIACRITICS = /\p{Diacritic}/gu

export function normalizeWakeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Variantes aceptadas (el motor de voz suele "oír" estas). */
const WAKE_WORDS = [
  'growii',
  'groui',
  'growi',
  'griwi',
  'grouwi',
  'grovi',
  'grovii',
  'growli',
  'grolli',
]
const WAKE_ALTERNATIVE = new RegExp(
  `(?:^|\\s)(oye|hey|hola)\\s+(${WAKE_WORDS.join('|')})(?:\\s|$)`,
)
const WAKE_PLAIN = new RegExp(
  `(?:^|\\s)(${WAKE_WORDS.join('|')})(?:\\s|$)`,
)

export interface WakeMatch {
  /** Texto normalizado tras el final de la palabra de activación. */
  command: string
  /** true si apareció "oye/hey/hola growii". */
  greeted: boolean
}

/**
 * Devuelve el comando si el texto contiene la wake word; si no, null.
 * El comando puede ser vacío ("Growii" a secas → se pregunta "¿Dime?").
 */
export function matchWakeWord(raw: string): WakeMatch | null {
  const text = normalizeWakeText(raw)
  if (!text) return null

  const greetedMatch = WAKE_ALTERNATIVE.exec(text)
  if (greetedMatch) {
    const end = greetedMatch.index + greetedMatch[0].length
    return { command: text.slice(end).trim(), greeted: true }
  }

  const plainMatch = WAKE_PLAIN.exec(text)
  if (plainMatch) {
    const end = plainMatch.index + plainMatch[0].length
    return { command: text.slice(end).trim(), greeted: false }
  }

  return null
}
