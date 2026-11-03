import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Indica si el usuario pidió reducir el movimiento.
 * Se usa para desactivar flotación, parpadeos y alternancia de boca.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    if (typeof window === 'undefined') return

    const media = window.matchMedia(QUERY)
    const onChange = () => setReduced(media.matches)

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}
