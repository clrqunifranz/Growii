import { useEffect, useRef, useState } from 'react'
import { PRISMO_LAYERS, PRISMO_LOGO } from '../config/prismo-assets'
import type { PrismoAssetKey } from '../config/prismo-assets'
import type { PrismoSpeechVariant, PrismoStatus } from '../types/prismo'
import type { SpeechBoundary } from '../types/speech'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { buildMouthSchedule, findWordStartAt } from '../utils/speechSchedule'
import type { MouthEvent, MouthFrame } from '../utils/speechSchedule'

interface AvatarProps {
  status: PrismoStatus
  speechVariant?: PrismoSpeechVariant
  /** Texto que se está reproduciendo (para programar la boca). */
  speechText?: string | null
  /** Última palabra alcanzada por el TTS (onboundary). */
  boundary?: SpeechBoundary | null
}

/** Retardo inicial antes de la primera apertura (latencia de arranque del TTS). */
const SPEECH_START_DELAY_MS = 110
/** Retardo al re-anclar tras el primer `onboundary`. */
const REANCHOR_DELAY_MS = 80
/** Alternativa orgánica si no hay texto que programar. */
const MOUTH_FRAME_DURATION_MS = 175
/** Pose "explicando" al comenzar una explicación (no es un fotograma de boca). */
const EXPLAIN_HOLD_MS = 1800
/** Parpadeo ocasional en reposo. 120–180 ms visible. */
const BLINK_MS = 150
const BLINK_MIN_DELAY_MS = 2800
const BLINK_MAX_DELAY_MS = 5600

function assetAlt(status: PrismoStatus): string {
  switch (status) {
    case 'greeting':
      return 'Prismo saludando'
    case 'listening':
      return 'Prismo escuchando'
    case 'thinking':
      return 'Prismo pensando la respuesta'
    case 'speaking':
      return 'Prismo hablando'
    case 'idle':
      return 'Prismo, avatar de ALMA, en espera'
  }
}

/**
 * Selección centralizada de pose: depende únicamente del estado real
 * de la aplicación (status + speechVariant) y de los sub-estados
 * transitorios mouthFrame / blinking / explainHold.
 */
function selectPose(
  status: PrismoStatus,
  mouthFrame: MouthFrame,
  blinking: boolean,
  explainHold: boolean,
): PrismoAssetKey {
  switch (status) {
    case 'greeting':
      return 'greeting'
    case 'listening':
      return 'listening'
    case 'thinking':
      return 'thinking'
    case 'speaking':
      if (explainHold) return 'explaining'
      return mouthFrame
    case 'idle':
      return blinking ? 'blink' : 'idle'
  }
}

export function Avatar({
  status,
  speechVariant = 'answer',
  speechText = null,
  boundary = null,
}: AvatarProps) {
  const reducedMotion = useReducedMotion()
  const mouthTimersRef = useRef<number[]>([])
  const anchoredRef = useRef(false)
  const [blinking, setBlinking] = useState(false)
  const [mouthFrame, setMouthFrame] = useState<MouthFrame>('speakingClosed')
  const [explainHold, setExplainHold] = useState(false)
  const [failedLayers, setFailedLayers] = useState<ReadonlySet<PrismoAssetKey>>(
    () => new Set(),
  )

  // Parpadeo ocasional SOLO en reposo (nunca escuchando/pensando/hablando).
  useEffect(() => {
    if (status !== 'idle' || reducedMotion) {
      setBlinking(false)
      return
    }

    let delayTimer = 0
    let blinkTimer = 0
    let cancelled = false

    const scheduleBlink = () => {
      const delay =
        BLINK_MIN_DELAY_MS +
        Math.random() * (BLINK_MAX_DELAY_MS - BLINK_MIN_DELAY_MS)

      delayTimer = window.setTimeout(() => {
        setBlinking(true)
        blinkTimer = window.setTimeout(() => {
          setBlinking(false)
          if (!cancelled) scheduleBlink()
        }, BLINK_MS)
      }, delay)
    }

    scheduleBlink()

    return () => {
      cancelled = true
      window.clearTimeout(delayTimer)
      window.clearTimeout(blinkTimer)
    }
  }, [status, reducedMotion])

  const clearMouthTimers = () => {
    for (const timer of mouthTimersRef.current) {
      window.clearTimeout(timer)
    }
    mouthTimersRef.current = []
  }

  const runMouthEvents = (events: MouthEvent[]) => {
    clearMouthTimers()
    mouthTimersRef.current = events.map((event) =>
      window.setTimeout(() => setMouthFrame(event.frame), event.at),
    )
  }

  // Respaldo orgánico si no hay texto que programar: ciclo suave de
  // me-medio-abierto-o redondeada, nunca en metrónomo.
  const ORGANIC_SEQUENCE: MouthFrame[] = [
    'speakingMid',
    'speakingOpen',
    'speakingMid',
    'speakingRound',
    'speakingMid',
    'speakingOpen',
    'speakingClosed',
  ]

  const runOrganicMouth = () => {
    clearMouthTimers()
    setMouthFrame('speakingClosed')
    let step = 0

    const scheduleNext = () => {
      const timer = window.setTimeout(() => {
        setMouthFrame(ORGANIC_SEQUENCE[step % ORGANIC_SEQUENCE.length])
        step += 1 + (Math.random() < 0.25 ? 1 : 0)
        scheduleNext()
      }, MOUTH_FRAME_DURATION_MS + Math.random() * 90)

      mouthTimersRef.current.push(timer)
    }

    scheduleNext()

    return clearMouthTimers
  }

  // Boca sincronizada: programación sílaba a sílaba a partir del texto,
  // re-anclada al primer evento onboundary (corrige la latencia del TTS).
  useEffect(() => {
    clearMouthTimers()
    anchoredRef.current = false

    if (status !== 'speaking' || reducedMotion) {
      setMouthFrame('speakingClosed')
      return undefined
    }

    if (!speechText) {
      return runOrganicMouth()
    }

    setMouthFrame('speakingClosed')
    runMouthEvents(buildMouthSchedule(speechText, SPEECH_START_DELAY_MS))
    return clearMouthTimers
  }, [status, speechText, reducedMotion])

  // Primer onboundary: reconstruye la programación desde esa palabra.
  useEffect(() => {
    if (
      !boundary ||
      anchoredRef.current ||
      status !== 'speaking' ||
      !speechText ||
      reducedMotion
    ) {
      return
    }

    if (boundary.charIndex >= speechText.length) return

    anchoredRef.current = true
    const start = findWordStartAt(speechText, boundary.charIndex)
    runMouthEvents(
      buildMouthSchedule(speechText.slice(start), REANCHOR_DELAY_MS),
    )
  }, [boundary, status, speechText, reducedMotion])

  // Limpiar siempre al desmontar.
  useEffect(() => clearMouthTimers, [])

  // Pose "explicando" una sola vez al comenzar una explicación hablada.
  useEffect(() => {
    if (status !== 'speaking' || speechVariant !== 'guide' || reducedMotion) {
      setExplainHold(false)
      return
    }

    setExplainHold(true)
    const timer = window.setTimeout(() => setExplainHold(false), EXPLAIN_HOLD_MS)

    return () => window.clearTimeout(timer)
  }, [status, speechVariant, reducedMotion])

  const wantedPose = selectPose(status, mouthFrame, blinking, explainHold)
  const activeKey: PrismoAssetKey | null = failedLayers.has(wantedPose)
    ? failedLayers.has('idle')
      ? null
      : 'idle'
    : wantedPose

  const markLayerFailed = (key: PrismoAssetKey) => {
    setFailedLayers((current) => {
      if (current.has(key)) return current
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

  return (
    <figure className={`avatar avatar--hero avatar--${status}`} data-status={status}>
      <div className="avatar__stage">
        {PRISMO_LAYERS.map((layer) => {
          const isActive = layer.key === activeKey

          return (
            <img
              key={layer.key}
              className={`avatar__layer${isActive ? ' is-active' : ''}`}
              src={layer.src}
              alt={isActive ? assetAlt(status) : ''}
              aria-hidden={!isActive}
              decoding="async"
              draggable={false}
              style={layer.filter ? { filter: layer.filter } : undefined}
              onError={() => markLayerFailed(layer.key)}
            />
          )
        })}
        <img
          className="avatar__logo"
          src={PRISMO_LOGO}
          alt="Logotipo de UNIFRANZ"
          decoding="async"
          draggable={false}
        />
      </div>
    </figure>
  )
}
