/**
 * Programación estimada del movimiento de la boca a partir del texto.
 *
 * La Web Speech API no expone la amplitud del audio, así que la opción
 * realista es: (1) precomputar la apertura de boca sílaba a sílaba según la
 * VOCAL de cada sílaba y su acentuación, y (2) re-anclar la programación al
 * primer evento `onboundary` del motor (una palabra), que corrige la
 * latencia de arranque del TTS.
 *
 * Fotogramas (los 3+1 de habla comparten encuadre y taza alzada):
 * - a / á            → speakingOpen   (mandíbula caída)
 * - o / ó, u / ú     → speakingRound  (boca redondeada)
 * - e / é, i / í     → speakingMid    (boca entreabierta)
 * - sílaba acentuada → speakingEmphatic (apertura acentuada y viva)
 * - entre palabras   → speakingClosed  (pausa breve)
 * - pausas fuertes (, . ; : ! ? …) y alguna pausa normal → blink
 *   (ojosclosed: "sonrisa con ojos cerrados"; la taza baja, como en reposo)
 */

/** Velocidad de la voz. 0.88 = habla pausada y clara. */
export const SPEECH_RATE = 0.88

export type MouthFrame =
  | 'speakingClosed'
  | 'speakingMid'
  | 'speakingOpen'
  | 'speakingRound'
  | 'speakingEmphatic'
  | 'blink'

export interface MouthEvent {
  /** ms desde el inicio de la programación */
  at: number
  frame: MouthFrame
}

/**
 * Duración media de una sílaba con SPEECH_RATE.
 * A rate 0.88 la sílaba real dura ~1/0.88 más que a rate 1 (160 ms).
 */
const SYLLABLE_MS = 180
/** Pausa breve entre palabras (boca cerrada). */
const WORD_GAP_MS = 100
/** Las pausas por puntuación (, . …) duran ~2.4 veces la pausa normal. */
const STRONG_PAUSE_FACTOR = 2.4
/** Probabilidad de "sonrisa con ojos cerrados" en pausa fuerte / pausa normal. */
const BLINK_ON_STRONG_PAUSE = 0.6
const BLINK_ON_WORD_GAP = 0.12

const WORD_PATTERN = /\S+/g
const VOWEL_GROUP = /[aeiouáéíóúü]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?…]+$/

/** Fotograma según el núcleo vocálico de la sílaba. */
function frameForVowelGroup(group: string): MouthFrame {
  const vowels = group.toLowerCase()

  // 'a' domina el gesto; si no hay 'a', o/u redondean la boca.
  if (vowels.includes('a')) return 'speakingOpen'
  if (vowels.includes('o') || vowels.includes('u')) return 'speakingRound'
  return 'speakingMid'
}

/** Énfasis prosódico: solo se acentúa la apertura, nunca la redondeada. */
function emphasize(frame: MouthFrame): MouthFrame {
  return frame === 'speakingOpen' || frame === 'speakingMid'
    ? 'speakingEmphatic'
    : frame
}

/**
 * Índice de la sílaba acentuada de la palabra (0 = primera).
 * Reglas del español: si lleva tilde, cae en esa vocal; si termina en
 * vocal, n o s → llana (penúltima); en otro caso → aguda (última).
 */
function stressedSyllableIndex(word: string): number {
  const groups = [...word.matchAll(new RegExp(VOWEL_GROUP))]
  const count = groups.length

  if (count <= 1) return 0

  const accentAt = word.toLowerCase().search(/[áéíóú]/)

  if (accentAt >= 0) {
    for (let i = 0; i < count; i += 1) {
      const start = groups[i].index ?? 0
      if (accentAt >= start && accentAt < start + groups[i][0].length) {
        return i
      }
    }
    return count - 1
  }

  const stripped = word.toLowerCase().replace(/[^a-záéíóúüñ]/g, '')
  if (!stripped) return count - 1

  const last = stripped.slice(-1)
  if (/[aeiouü]/.test(last) || last === 'n' || last === 's') {
    return count - 2 // llana
  }

  return count - 1 // aguda
}

/**
 * Construye los eventos de boca para `text` comenzando tras `startDelayMs`.
 * Cada sílaba emite su fotograma durante toda su duración; el fundido CSS
 * entre capas hace que los cambios sean continuos (sin cortes).
 */
export function buildMouthSchedule(text: string, startDelayMs: number): MouthEvent[] {
  const events: MouthEvent[] = []
  let cursor = startDelayMs

  const regex = new RegExp(WORD_PATTERN)
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    const rawWord = match[0]
    const hasStrongPause = TRAILING_PUNCTUATION.test(rawWord)
    const word = rawWord.replace(TRAILING_PUNCTUATION, '')
    const groups = word.match(new RegExp(VOWEL_GROUP)) ?? []

    if (groups.length === 0) {
      cursor += SYLLABLE_MS
      continue
    }

    const stress = stressedSyllableIndex(word)

    for (let i = 0; i < groups.length; i += 1) {
      const base = frameForVowelGroup(groups[i])
      const frame = i === stress ? emphasize(base) : base
      events.push({ at: Math.round(cursor), frame })
      cursor += SYLLABLE_MS
    }

    const gap = WORD_GAP_MS * (hasStrongPause ? STRONG_PAUSE_FACTOR : 1)
    cursor += gap

    const blinkChance = hasStrongPause ? BLINK_ON_STRONG_PAUSE : BLINK_ON_WORD_GAP
    const restFrame: MouthFrame =
      Math.random() < blinkChance ? 'blink' : 'speakingClosed'
    events.push({ at: Math.round(cursor - gap), frame: restFrame })
  }

  events.push({ at: Math.round(cursor), frame: 'speakingClosed' })
  return events
}

/**
 * Índice del primer carácter de la palabra que contiene o sigue a
 * `charIndex`. Se usa para re-anclar la programación desde el texto
 * restante cuando llega el primer evento `onboundary`.
 */
export function findWordStartAt(text: string, charIndex: number): number {
  const regex = new RegExp(WORD_PATTERN)
  let match: RegExpExecArray | null

  while ((match = regex.exec(text))) {
    if (match.index + match[0].length > charIndex) {
      return match.index
    }
  }

  return text.length
}
