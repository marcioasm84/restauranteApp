import type { Role } from '../types'

const TOKEN_KEY = 'mesa-viva-admin-token'
const ROLE_KEY = 'mesa-viva-staff-role'

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getRole(): Role | null {
  try {
    return localStorage.getItem(ROLE_KEY) as Role | null
  } catch {
    return null
  }
}

export function setToken(token: string, role: Role) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(ROLE_KEY, role)
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
  } catch {
    // ignore
  }
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// Admin can access everything; any other role only passes for routes that
// explicitly list it.
export function hasAccess(allowed: Role[]): boolean {
  const role = getRole()
  if (!role) return false
  return role === 'admin' || allowed.includes(role)
}

export function homeRouteForRole(role: Role): string {
  if (role === 'garcom') return '/garcom'
  if (role === 'cozinha') return '/cozinha'
  return '/admin'
}
