export type ChatRole = 'user' | 'assistant'

export type ProfileId = 'estudiante' | 'alumni' | 'empresa'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

export interface ChatApiMessage {
  role: ChatRole
  content: string
}

export interface ChatResponse {
  reply: string
}

export interface ChatErrorResponse {
  error?: string
}

export interface ChatResult {
  reply: string
}
