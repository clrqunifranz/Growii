import type { ProfileId } from '../types/chat'

export interface ProfileOption {
  id: ProfileId
  index: string
  label: string
  questions: string[]
}

export const PROFILE_OPTIONS: ProfileOption[] = [
  {
    id: 'estudiante',
    index: '01',
    label: 'Estudiante',
    questions: [
      '¿Qué servicios ofrece Red Alumni para estudiantes?',
      '¿Cómo puedo prepararme para una entrevista?',
      '¿Cómo puedo mejorar mi currículum?',
    ],
  },
  {
    id: 'alumni',
    index: '02',
    label: 'Alumni',
    questions: [
      '¿Qué beneficios tengo como graduado de UNIFRANZ?',
      '¿Cómo funciona el Career Coaching?',
      '¿Cómo puedo participar en actividades de networking?',
    ],
  },
  {
    id: 'empresa',
    index: '03',
    label: 'Empresa',
    questions: [
      '¿Cómo puede mi empresa vincularse con Red Alumni?',
      '¿Qué perfiles puedo encontrar en la red de Alumni?',
      '¿Cómo puedo publicar una oportunidad laboral?',
    ],
  },
]
