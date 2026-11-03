import { useEffect, useState } from 'react'
import { PRISMO_LAYERS, PRISMO_LOGO } from '../config/prismo-assets'
import type { PrismoAssetKey } from '../config/prismo-assets'
import type { PrismoSpeechVariant, PrismoStatus } from '../types/prismo'
import { useReducedMotion } from '../hooks/useReducedMotion'

interface AvatarProps {
  status: PrismoStatus
  speechVariant?: PrismoSpeechVariant
}

/** Alternancia de boca solo mientras speechSynthesis reproduce. 120–180 ms por fotograma. */
const MOUTH_INTERVAL_MS = 150
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
 * transitorios mouthOpen / blinking / explainHold.
 */
function selectPose(
  status: PrismoStatus,
  mouthOpen: boolean,
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
      return mouthOpen ? 'speakingOpen' : 'speakingClosed'
    case 'idle':
      return blinking ? 'blink' : 'idle'
  }
}

export function Avatar({ status, speechVariant = 'answer' }: AvatarProps) {
  const reducedMotion = useReducedMotion()
  const [blinking, setBlinking] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(true)
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

  // Alternancia de boca SOLO mientras speechSynthesis reproduce.
  useEffect(() => {
    if (status !== 'speaking' || reducedMotion) {
      setMouthOpen(true)
      return
    }

    setMouthOpen(true)
    const interval = window.setInterval(() => {
      setMouthOpen((current) => !current)
    }, MOUTH_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [status, reducedMotion])

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

  const wantedPose = selectPose(status, mouthOpen, blinking, explainHold)
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
