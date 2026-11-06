export interface SpeechBoundary {
  /** Índice de carácter del inicio de la palabra reconocida. */
  charIndex: number
  /** Momento (Date.now()) en que llegó el evento. */
  at: number
}

export interface GrowiiSpeechAlternative {
  transcript: string
  confidence: number
}

export interface GrowiiSpeechResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: GrowiiSpeechAlternative
}

export interface GrowiiSpeechResultList {
  readonly length: number
  [index: number]: GrowiiSpeechResult
}

export interface GrowiiSpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: GrowiiSpeechResultList
}

export interface GrowiiSpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

export interface GrowiiSpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: GrowiiSpeechRecognitionEvent) => void) | null
  onerror: ((event: GrowiiSpeechRecognitionErrorEvent) => void) | null
}

export type GrowiiSpeechRecognitionConstructor = new () => GrowiiSpeechRecognition

export type GrowiiSpeechWindow = Window & {
  SpeechRecognition?: GrowiiSpeechRecognitionConstructor
  webkitSpeechRecognition?: GrowiiSpeechRecognitionConstructor
}
