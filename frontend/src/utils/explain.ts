/**
 * Heurística ligera para detectar si una respuesta de ALMA es una
 * explicación o una serie de pasos/recomendaciones.
 * Se usa solo para elegir la pose "explicando" del avatar;
 * no afecta al contenido ni al contrato con el backend.
 */
export function explainLikely(reply: string): boolean {
  const text = reply.toLocaleLowerCase('es').replace(/\s+/g, ' ')

  return /(:[^\n]{1,})?\n\s*\d+[).]|\b(pasos?|instrucciones|recomendaci[oó]n|sugerencias?|primero|segundo|luego|despu[eé]s|finalmente|para empezar|haz|considera|evita|recomiendo|te sugiero)\b/i.test(
    text,
  )
}
