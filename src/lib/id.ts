// crypto.randomUUID() só existe em contexto seguro (HTTPS ou localhost). No
// piloto o app roda em HTTP puro, onde ela é undefined e quebra silenciosamente
// o clique que a chamar. crypto.getRandomValues() está disponível em qualquer
// contexto, então é usado como alternativa (UUID v4).
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
