import type {
  AnalyticsSummary,
  PublicTenant,
  Role,
  StaffMember,
  TenantBranding,
  TenantSummary,
} from '../types'

const API_PORT = 4000

export function apiBase(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  // "same-origin" means: call this same host/port (no :4000) — used by the
  // Docker build, where nginx proxies /api to the backend container, so the
  // app works behind any origin (LAN IP, localhost, an ngrok tunnel, ...)
  // without knowing that origin at build time.
  if (envUrl === 'same-origin') return ''
  if (envUrl) return envUrl
  return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`
}

// Logos uploaded through the Super Admin panel are stored on the backend
// (not bundled with the frontend), so their URL needs the backend's own
// origin — same logic apiBase() already uses for API calls. A logo set the
// old way, as a plain external URL or a frontend-bundled public/ path, is
// left untouched.
export function resolveAssetUrl(url?: string | null): string | null {
  if (!url) return null
  if (url.startsWith('/api/')) return `${apiBase()}${url}`
  return url
}

async function parseOrThrow(res: Response, fallback: string) {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.message ?? fallback)
  return body
}

export async function fetchTenantInfo(): Promise<TenantBranding> {
  const res = await fetch(`${apiBase()}/api/tenant`)
  return parseOrThrow(res, 'Não foi possível identificar este restaurante.')
}

export async function fetchPublicTenants(): Promise<PublicTenant[]> {
  const res = await fetch(`${apiBase()}/api/tenants`)
  return parseOrThrow(res, 'Não foi possível carregar a lista de restaurantes.')
}

export async function loginRequest(
  username: string,
  password: string,
): Promise<{ token: string; role: Role; displayName: string }> {
  const res = await fetch(`${apiBase()}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await parseOrThrow(res, 'Não foi possível entrar. Tente novamente.')
  return { token: body.token as string, role: body.role as Role, displayName: body.displayName as string }
}

export interface AnalyticsRange {
  from: number
  to: number
}

export async function fetchAnalytics(token: string, range: AnalyticsRange): Promise<AnalyticsSummary> {
  const res = await fetch(`${apiBase()}/api/analytics?from=${range.from}&to=${range.to}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error('Não foi possível carregar os relatórios.')
  }
  return res.json()
}

// Baixa o CSV do período como arquivo — sem biblioteca extra: busca o blob
// e aciona um <a download> temporário, o mesmo truque usado por qualquer
// app web comum (nada a ver com a sandbox de artifacts).
export async function exportAnalyticsCsv(token: string, range: AnalyticsRange, filename: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/analytics/export?from=${range.from}&to=${range.to}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error('Não foi possível exportar o relatório.')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// --- Equipe (contas individuais de garçom/cozinha, Fase 8) -----------------

export async function fetchStaff(token: string): Promise<StaffMember[]> {
  const res = await fetch(`${apiBase()}/api/staff`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseOrThrow(res, 'Não foi possível carregar a equipe.')
}

export async function createStaffRequest(
  token: string,
  input: { username: string; displayName: string; role: Role; password: string },
): Promise<StaffMember> {
  const res = await fetch(`${apiBase()}/api/staff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  return parseOrThrow(res, 'Não foi possível criar a conta.')
}

export async function updateStaffRequest(
  token: string,
  id: string,
  patch: { displayName?: string; role?: Role; active?: boolean },
): Promise<StaffMember> {
  const res = await fetch(`${apiBase()}/api/staff/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  })
  return parseOrThrow(res, 'Não foi possível atualizar a conta.')
}

export async function resetStaffMemberPasswordRequest(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/staff/${id}/password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password }),
  })
  await parseOrThrow(res, 'Não foi possível trocar a senha.')
}

export async function deleteStaffRequest(token: string, id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/staff/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  await parseOrThrow(res, 'Não foi possível remover a conta.')
}

// --- Super Admin (plataforma, não é por cliente) ---------------------------

export async function superAdminLoginRequest(username: string, password: string): Promise<string> {
  const res = await fetch(`${apiBase()}/api/super-admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const body = await parseOrThrow(res, 'Não foi possível entrar.')
  return body.token as string
}

export async function fetchTenants(token: string): Promise<TenantSummary[]> {
  const res = await fetch(`${apiBase()}/api/super-admin/tenants`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseOrThrow(res, 'Não foi possível carregar os clientes.')
}

export async function uploadLogoRequest(token: string, file: File): Promise<string> {
  const formData = new FormData()
  formData.append('logo', file)
  const res = await fetch(`${apiBase()}/api/super-admin/upload-logo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  })
  const body = await parseOrThrow(res, 'Não foi possível enviar a imagem.')
  return body.url as string
}

export async function geocodeAddressRequest(
  token: string,
  address: string,
): Promise<{ lat: number; lng: number }> {
  const res = await fetch(`${apiBase()}/api/super-admin/geocode?address=${encodeURIComponent(address)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return parseOrThrow(res, 'Não foi possível localizar esse endereço.')
}

export interface TenantContactInput {
  logoUrl?: string | null
  primaryColor?: string
  accentColor?: string
  responsibleName?: string
  phone?: string
  email?: string
  address?: string
  latitude?: number
  longitude?: number
  notes?: string
}

export async function createTenantRequest(
  token: string,
  input: TenantContactInput & {
    name: string
    slug: string
    staff: { admin: string; garcom: string; cozinha: string }
  },
): Promise<TenantSummary> {
  const res = await fetch(`${apiBase()}/api/super-admin/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  })
  return parseOrThrow(res, 'Não foi possível criar o cliente.')
}

export async function updateTenantRequest(
  token: string,
  id: string,
  patch: Partial<TenantContactInput> & {
    name?: string
    status?: TenantSummary['status']
    plan?: string
  },
): Promise<TenantSummary> {
  const res = await fetch(`${apiBase()}/api/super-admin/tenants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  })
  return parseOrThrow(res, 'Não foi possível atualizar o cliente.')
}

export async function resendCredentialsRequest(token: string, id: string): Promise<void> {
  const res = await fetch(`${apiBase()}/api/super-admin/tenants/${id}/resend-credentials`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  await parseOrThrow(res, 'Não foi possível reenviar as credenciais.')
}
