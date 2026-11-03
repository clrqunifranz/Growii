export type PrismoStatus =
  | 'idle'
  | 'greeting'
  | 'listening'
  | 'thinking'
  | 'speaking'

export type PrismoSpeechVariant = 'answer' | 'guide'
export type VoiceState = PrismoStatus | 'error'
