export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const orderStatusLabel: Record<string, string> = {
  recebido: 'Recebido',
  preparando: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
}

export const orderStatusOrder = ['recebido', 'preparando', 'pronto', 'entregue'] as const

export function minutesAgo(timestamp: number, now: number) {
  const mins = Math.max(0, Math.floor((now - timestamp) / 60000))
  return mins === 0 ? 'agora' : `há ${mins} min`
}
