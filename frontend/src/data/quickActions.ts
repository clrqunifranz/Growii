import type { ProfileId } from '../types/chat'

/**
 * Accesos rápidos del chat: consultas reales que se envían a Growii.
 * Se adaptan al perfil detectado; sin perfil, se muestran temas generales.
 */

export const GENERIC_QUICK_ACTIONS = [
  'Oportunidades laborales',
  'Prácticas profesionales',
  'Servicios para graduados',
  'Conectar con empresas',
  'Información de Red Alumni',
] as const

export const PROFILE_QUICK_ACTIONS: Record<ProfileId, readonly string[]> = {
  estudiante: [
    '¿Cómo encuentro prácticas profesionales?',
    'Oportunidades laborales para estudiantes',
    '¿Cómo mejoro mi CV?',
    '¿Cómo me preparo para una entrevista?',
  ],
  alumni: [
    'Servicios para graduados de Red Alumni',
    '¿Cómo accedo a oportunidades laborales?',
    'Career coaching y mentoría',
    'Networking y actividades de Red Alumni',
  ],
  empresa: [
    'Quiero conectar con talento UNIFRANZ',
    '¿Cómo publico una vacante en Red Alumni?',
    '¿Qué perfiles puedo encontrar en la red?',
    '¿Cómo vinculamos mi empresa con UNIFRANZ?',
  ],
}

export function quickActionsFor(profile: ProfileId | null): readonly string[] {
  return profile ? PROFILE_QUICK_ACTIONS[profile] : GENERIC_QUICK_ACTIONS
}

export const PROFILE_LABEL: Record<ProfileId, string> = {
  estudiante: 'Estudiante',
  alumni: 'Graduado',
  empresa: 'Empresa',
}

/** Ciclo de corrección manual: estudiante → graduado → empresa → sin perfil. */
export function nextProfile(profile: ProfileId | null): ProfileId | null {
  switch (profile) {
    case null:
      return 'estudiante'
    case 'estudiante':
      return 'alumni'
    case 'alumni':
      return 'empresa'
    case 'empresa':
      return null
  }
}
