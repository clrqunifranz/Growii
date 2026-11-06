import type { ProfileId } from '../types/chat'

/**
 * Inferencia heurística de perfil a partir de palabras clave EXPLÍCITAS
 * del visitante. No es IA: solo reconoce expresiones claras y deja el
 * perfil en "desconocido" si hay duda. Nunca infiere por un saludo genérico.
 */

export type DetectedProfile = ProfileId | null

const STUDENT_PATTERNS = [
  /\b(estudiante|estudio|universitari[oa]|carrera|semestre|materia|facultad|ingeniería|ingenieria|administraci[óo]n|contador(?:ía|ia)?|derecho|arquitectura|medicina|enfermería|enfermeria|psicolog[ií]a|comunicación|comunicacion)\b/i,
  /\bp[ráa]ctica(s)?\s+(profesional(es)?|pre\s?profesional(es)?|en\s+empresas?)\b/i,
  /\bsoy\s+(un\s+|una\s+)?estudiante\b/i,
]

const GRADUATE_PATTERNS = [
  /\b(egresad[oa]|graduad[oa]|alumni|alumn[oa]|licenciad[oa]|titulad[oa]|ingenier[oa]|maestr[ií]a|doctorado|posgrado)\b/i,
  /\b(me\s+)?(gradu[ée]|egres[ée]|titul[ée])\b/i,
  /\bsoy\s+(un\s+|una\s+)?(egresad[oa]|graduad[oa]|ex\s?alumn[oa])\b/i,
]

const COMPANY_PATTERNS = [
  /\b(empresa|compa[ñn][ií]a|organizaci[óo]n|institución|institucion)\b/i,
  /\b(reclutador(a)?|recurso\s+humano|RRHH|talento|contrat(amos|ar)|vacante(s)?|oportunidad(es)?\s+laboral(es)?|publicar\s+(una\s+)?oferta)\b/i,
  /\b(representamos|represento|somos\s+(una\s+)?empresa|buscamos\s+talento|queremos\s+contratar)\b/i,
]

const PATTERNS: Record<ProfileId, RegExp[]> = {
  estudiante: STUDENT_PATTERNS,
  alumni: GRADUATE_PATTERNS,
  empresa: COMPANY_PATTERNS,
}

export interface ProfileGuess {
  profile: DetectedProfile
  /** Coincidencias por categoría (para depurar en el monitoreo). */
  score: Record<ProfileId, number>
}

/**
 * Devuelve el perfil con más coincidencias, o null si hay empate o cero.
 * Nunca adivina: empate o duda => null (se pregunta al visitante).
 */
export function inferProfile(text: string): ProfileGuess {
  const score: Record<ProfileId, number> = {
    estudiante: 0,
    alumni: 0,
    empresa: 0,
  }

  for (const [profile, patterns] of Object.entries(PATTERNS) as Array<
    [ProfileId, RegExp[]]
  >) {
    for (const pattern of patterns) {
      if (pattern.test(text)) score[profile] += 1
    }
  }

  const ranked = (Object.entries(score) as Array<[ProfileId, number]>).sort(
    (a, b) => b[1] - a[1],
  )
  const [topProfile, topScore] = ranked[0]
  const [, secondScore] = ranked[1]

  if (topScore === 0) return { profile: null, score }
  if (topScore === secondScore) return { profile: null, score }

  return { profile: topProfile, score }
}
