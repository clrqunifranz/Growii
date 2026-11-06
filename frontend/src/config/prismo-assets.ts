/**
 * Recursos oficiales de Prismo, proporcionados por el equipo.
 * Todos viven en `public/assets/prismo/` y se referencian desde la raíz.
 *
 * Extensiones verificadas en disco:
 * - JPG: saludando, escuchando, thinking, explicando, mouth-closed, ojosclosed,
 *   intermedio, mamap, secue.
 * - PNG: mouth-open y el logo institucional de UNIFRANZ.
 *
 * Las imágenes comparten el mismo encuadre (cabeza ≈ 39% de la altura,
 * pies = 100%), por lo que comparten contenedor (9:16, `object-fit: contain`).
 * Cada capa aplica un filtro suave para emparejar el tono de fondo amarillo
 * y evitar "saltos" de color durante los fundidos; el personaje apenas se
 * ve afectado.
 */
export const PRISMO_ASSETS = {
  idle: '/assets/prismo/prismo-mouth-closed.jpg',
  greeting: '/assets/prismo/prismo-saludando.jpg',
  listening: '/assets/prismo/prismo-escuchando.jpg',
  thinking: '/assets/prismo/prismo-thinking.jpg',
  explaining: '/assets/prismo/prismo-explicando.jpg',
  blink: '/assets/prismo/prismo-ojosclosed.jpg',
  speakingOpen: '/assets/prismo/prismo-mouth-open.png',
  speakingClosed: '/assets/prismo/prismo-mouth-closed.jpg',
  speakingMid: '/assets/prismo/prismo-intermedio.jpg',
  speakingRound: '/assets/prismo/prismo-mamap.jpg',
  speakingEmphatic: '/assets/prismo/prismo-secue.jpg',
} as const

export const PRISMO_LOGO = '/assets/prismo/unifranz-logo.png'

export type PrismoAssetKey = keyof typeof PRISMO_ASSETS

export interface PrismoLayer {
  key: PrismoAssetKey
  src: string
  /** Filtro suave para emparejar el fondo entre imágenes. */
  filter?: string
}

export const PRISMO_LAYERS: readonly PrismoLayer[] = [
  { key: 'idle', src: PRISMO_ASSETS.idle },
  { key: 'greeting', src: PRISMO_ASSETS.greeting, filter: 'saturate(0.78) brightness(1.13)' },
  { key: 'listening', src: PRISMO_ASSETS.listening, filter: 'saturate(0.85) brightness(1.09)' },
  { key: 'thinking', src: PRISMO_ASSETS.thinking, filter: 'saturate(0.88) brightness(1.06)' },
  { key: 'explaining', src: PRISMO_ASSETS.explaining, filter: 'saturate(0.74) brightness(1.17)' },
  { key: 'blink', src: PRISMO_ASSETS.blink, filter: 'saturate(0.78) brightness(1.13)' },
  { key: 'speakingOpen', src: PRISMO_ASSETS.speakingOpen },
  { key: 'speakingClosed', src: PRISMO_ASSETS.speakingClosed },
  { key: 'speakingMid', src: PRISMO_ASSETS.speakingMid },
  { key: 'speakingRound', src: PRISMO_ASSETS.speakingRound, filter: 'saturate(0.96) brightness(1.02)' },
  { key: 'speakingEmphatic', src: PRISMO_ASSETS.speakingEmphatic },
]
