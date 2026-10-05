import type { AnalyticsSummary, Role } from '../types'

const API_PORT = 4000

function apiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  // "same-origin" means: call this same host/port (no :4000) — used by the
  // Docker build, where nginx proxies /api to the backend container, so the
  // app works behind any origin (LAN IP, localhost, an ngrok tunnel, ...)
  // without knowing that origin at build time.
  if (envUrl === 'same-origin') return ''
  if (envUrl) return envUrl
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<{ token: string; role: Role }> {
  const res = await fetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.message ?? 'Não foi possível entrar. Tente novamente.')
  }
  return { token: body.token as string, role: body.role as Role }
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
