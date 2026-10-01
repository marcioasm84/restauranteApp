import type { AnalyticsSummary } from '../types'

const API_PORT = 4000

function apiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl) return envUrl
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
}

export async function loginRequest(username: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message ?? 'Não foi possível entrar. Tente novamente.')
  }
  return body.token as string
}

export async function fetchAnalytics(token: string): Promise<AnalyticsSummary> {
  const res = await fetch(`${apiBase()}/api/analytics`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error('Não foi possível carregar os relatórios.')
  }
  return res.json()
}
