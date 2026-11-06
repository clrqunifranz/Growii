import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { GrowiiStatus } from '../types/growii'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { buildMouthSchedule } from '../utils/speechSchedule'
import type { MouthFrame } from '../utils/speechSchedule'

const OWL_URL = '/assets/growii/animal_owl.glb'

/**
 * Pose cerrada del pico = primer frame del clip `call` (reposo).
 * Pose abierta = frame central del mismo clip. Se interpolan con
 * slerp según la apertura deseada (0..1).
 */
const JAW_CLOSED = new THREE.Quaternion(0, 0.995, 0.097, 0).normalize()
const JAW_OPEN = new THREE.Quaternion(0, 0.932, 0.363, 0).normalize()

/** Apertura del pico por fotograma de boca (programación silábica). */
const FRAME_OPENNESS: Record<MouthFrame, number> = {
  speakingClosed: 0,
  blink: 0,
  speakingMid: 0.62,
  speakingRound: 0.55,
  speakingOpen: 0.95,
  speakingEmphatic: 1,
}
/** Respaldo orgánico si no hay texto que programar. */
const ORGANIC_SEQUENCE: MouthFrame[] = [
  'speakingMid',
  'speakingOpen',
  'speakingMid',
  'speakingRound',
  'speakingMid',
  'speakingOpen',
  'speakingClosed',
]
const ORGANIC_STEP_MS = 210
const SPEECH_START_DELAY_MS = 110

/** Qué clip base acompaña a cada estado. */
const STATUS_CLIP: Record<GrowiiStatus, string> = {
  greeting: 'idle',
  idle: 'idle',
  listening: 'idle_alt',
  thinking: 'idle_alt',
  speaking: 'idle',
  error: 'sit',
}
const STATUS_TIMESCALE: Record<GrowiiStatus, number> = {
  greeting: 1,
  idle: 1,
  listening: 0.85,
  thinking: 0.45,
  speaking: 1,
  error: 0.35,
}

interface LoadedOwl {
  scene: THREE.Group
  animations: THREE.AnimationClip[]
}

interface OwlModelProps {
  status: GrowiiStatus
  speechText?: string | null
  onReady?: () => void
}

function OwlModel({ status, speechText = null, onReady }: OwlModelProps) {
  const reducedMotion = useReducedMotion()
  const camera = useThree((state) => state.camera)
  const viewport = useThree((state) => state.size)
  const [gltf, setGltf] = useState<LoadedOwl | null>(null)

  const mixerRef = useRef<THREE.AnimationMixer | null>(null)
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map())
  const jawRef = useRef<THREE.Object3D | null>(null)
  const jawOpenRef = useRef(0)
  const jawTargetRef = useRef(0)
  const mouthTimersRef = useRef<number[]>([])

  // Carga del GLB (una sola vez).
  useEffect(() => {
    let alive = true
    const loader = new GLTFLoader()
    loader.load(
      OWL_URL,
      (loaded) => {
        if (!alive) return
        setGltf({ scene: loaded.scene, animations: loaded.animations })
      },
      undefined,
      (error) => {
        console.error('[GROWII] No se pudo cargar el búho 3D.', error)
      },
    )
    return () => {
      alive = false
    }
  }, [])

  // Clips sin pistas de Jaw: el pico lo controla la programación
  // silábica (o queda cerrado). Las pistas de Lids se conservan
  // para que el parpadeo siga funcionando dentro del clip `idle`.
  const jawlessClips = useMemo(
    () =>
      gltf
        ? gltf.animations.map(
            (clip) =>
              new THREE.AnimationClip(
                clip.name,
                clip.duration,
                clip.tracks.filter((track) => !track.name.startsWith('Jaw.')),
              ),
          )
        : null,
    [gltf],
  )

  // Encuadre automático según la caja del modelo.
  useEffect(() => {
    if (!gltf) return

    const box = new THREE.Box3().setFromObject(gltf.scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const fov = 30
    const halfFov = THREE.MathUtils.degToRad(fov / 2)
    // En lienzo vertical suele mandar el ancho: se ajusta la distancia
    // para que quepa entero y, a la vez, ocupe casi todo el encuadre.
    const aspect = viewport.width / Math.max(1, viewport.height)
    const distForHeight = size.y / 2 / Math.tan(halfFov)
    const distForWidth = size.x / 2 / (Math.tan(halfFov) * aspect)
    const distance = Math.max(distForHeight, distForWidth) * 1.08

    camera.position.set(center.x, center.y + size.y * 0.05, center.z + distance)
    camera.lookAt(center.x, center.y, center.z)
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    jawRef.current = gltf.scene.getObjectByName('Jaw') ?? null
    if (!jawRef.current) {
      console.warn('[GROWII] No se encontró el hueso Jaw; el pico no se animará.')
    }
    onReady?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf, viewport.width, viewport.height])

  // Mezclador + acciones.
  useEffect(() => {
    if (!gltf || !jawlessClips) return

    const mixer = new THREE.AnimationMixer(gltf.scene)
    mixerRef.current = mixer
    const map = new Map<string, THREE.AnimationAction>()

    for (const clip of jawlessClips) {
      const action = mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      map.set(clip.name, action)
    }

    actionsRef.current = map

    return () => {
      mixer.stopAllAction()
      mixer.uncacheRoot(gltf.scene)
      mixerRef.current = null
      actionsRef.current = new Map()
    }
  }, [gltf, jawlessClips])

  // Estado → clip base, con fundido.
  useEffect(() => {
    const map = actionsRef.current
    if (map.size === 0) return

    if (reducedMotion) {
      mixerRef.current?.stopAllAction()
      return
    }

    const wanted = STATUS_CLIP[status]
    const timeScale = STATUS_TIMESCALE[status]

    for (const [name, action] of map) {
      if (name === wanted) {
        action.reset()
        action.timeScale = timeScale
        action.fadeIn(0.35)
        action.play()
      } else {
        action.fadeOut(0.35)
      }
    }
  }, [status, gltf, reducedMotion])

  const clearMouthTimers = () => {
    for (const timer of mouthTimersRef.current) {
      window.clearTimeout(timer)
    }
    mouthTimersRef.current = []
  }

  // Programación del pico al hablar (misma base silábica que el
  // avatar 2D), o secuencia orgánica si no hay texto.
  useEffect(() => {
    clearMouthTimers()

    if (status !== 'speaking' || reducedMotion) {
      jawTargetRef.current = 0
      return clearMouthTimers
    }

    if (speechText) {
      jawTargetRef.current = 0
      const events = buildMouthSchedule(speechText, SPEECH_START_DELAY_MS)
      mouthTimersRef.current = events.map((event) =>
        window.setTimeout(
          () => {
            jawTargetRef.current = FRAME_OPENNESS[event.frame]
          },
          event.at,
        ),
      )
      return clearMouthTimers
    }

    let step = 0
    jawTargetRef.current = 0

    const tick = () => {
      jawTargetRef.current =
        FRAME_OPENNESS[ORGANIC_SEQUENCE[step % ORGANIC_SEQUENCE.length]]
      step += 1 + (Math.random() < 0.25 ? 1 : 0)
      mouthTimersRef.current.push(
        window.setTimeout(tick, ORGANIC_STEP_MS + Math.random() * 110),
      )
    }

    mouthTimersRef.current.push(window.setTimeout(tick, ORGANIC_STEP_MS))
    return clearMouthTimers
  }, [status, speechText, reducedMotion])

  // Limpieza al desmontar.
  useEffect(() => clearMouthTimers, [])

  useFrame((_, delta) => {
    mixerRef.current?.update(delta)

    const jaw = jawRef.current
    if (!jaw) return

    jawOpenRef.current = THREE.MathUtils.damp(
      jawOpenRef.current,
      jawTargetRef.current,
      13,
      delta,
    )
    jaw.quaternion.slerpQuaternions(JAW_CLOSED, JAW_OPEN, jawOpenRef.current)
  })

  if (!gltf) return null
  return <primitive object={gltf.scene} />
}

export interface GrowiiOwlProps {
  status: GrowiiStatus
  speechText?: string | null
  className?: string
  ariaLabel?: string
}

export function GrowiiOwl({
  status,
  speechText = null,
  className,
  ariaLabel = 'Growii, asistente de UNIFRANZ',
}: GrowiiOwlProps) {
  const [ready, setReady] = useState(false)

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{ position: 'relative', width: '100%', height: '100%' }}
    >
      <Canvas
        camera={{ position: [0, 0.7, 2.4], fov: 32 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <hemisphereLight args={['#fff8ec', '#241d16', 1.05]} />
        <directionalLight position={[2.5, 3.5, 3]} intensity={1.45} />
        <directionalLight position={[-3, 1.5, 1.5]} intensity={0.55} />
        <OwlModel
          status={status}
          speechText={speechText}
          onReady={() => setReady(true)}
        />
      </Canvas>
      {!ready && (
        <span className="growii-owl__loading">Cargando búho…</span>
      )}
    </div>
  )
}
