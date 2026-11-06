/**
 * Registro local de eventos para el panel interno de monitoreo.
 * Solo vive en memoria (anillo de últimos N eventos); no se envía
 * a ningún sitio ni persiste tras recargar.
 */

export type TelemetryKind =
  | 'recognition'
  | 'send'
  | 'response'
  | 'voice'
  | 'error'
  | 'profile'
  | 'system'

export interface TelemetryEvent {
  id: number
  at: number
  kind: TelemetryKind
  detail: string
  ok: boolean
}

const MAX_EVENTS = 120
const events: TelemetryEvent[] = []
let counter = 0

export function logEvent(kind: TelemetryKind, detail: string, ok = true): void {
  counter += 1
  events.push({ id: counter, at: Date.now(), kind, detail, ok })
  if (events.length > MAX_EVENTS) events.shift()
}

export function getEvents(): readonly TelemetryEvent[] {
  return events
}

export function clearEvents(): void {
  events.length = 0
}
