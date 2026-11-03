export interface AlmaSpeechAlternative {
  transcript: string
  confidence: number
}

export interface AlmaSpeechResult {
  readonly isFinal: boolean
  readonly length: number
  [index: number]: AlmaSpeechAlternative
}

export interface AlmaSpeechResultList {
  readonly length: number
  [index: number]: AlmaSpeechResult
}

export interface AlmaSpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: AlmaSpeechResultList
}

export interface AlmaSpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

export interface AlmaSpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((event: AlmaSpeechRecognitionEvent) => void) | null
  onerror: ((event: AlmaSpeechRecognitionErrorEvent) => void) | null
}

export type AlmaSpeechRecognitionConstructor = new () => AlmaSpeechRecognition

export type AlmaSpeechWindow = Window & {
  SpeechRecognition?: AlmaSpeechRecognitionConstructor
  webkitSpeechRecognition?: AlmaSpeechRecognitionConstructor
}
