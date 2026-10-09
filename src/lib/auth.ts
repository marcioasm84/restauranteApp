import type { Role } from '../types'

const TOKEN_KEY = 'mesa-viva-admin-token'
const ROLE_KEY = 'mesa-viva-staff-role'
const DISPLAY_NAME_KEY = 'mesa-viva-staff-name'

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

export function getDisplayName(): string | null {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string, role: Role, displayName: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(ROLE_KEY, role)
    localStorage.setItem(DISPLAY_NAME_KEY, displayName)
  } catch {
    // ignore (private browsing / storage disabled)
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(DISPLAY_NAME_KEY)
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

// Super admin is a platform-level account, not scoped to any tenant — kept
// under its own storage key so it never gets mixed up with staff sessions.
const SUPER_ADMIN_TOKEN_KEY = 'mesa-viva-super-admin-token'

export function getSuperAdminToken(): string | null {
  try {
    return localStorage.getItem(SUPER_ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setSuperAdminToken(token: string) {
  try {
    localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function clearSuperAdminToken() {
  try {
    localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY)
  } catch {
    // ignore
  }
}

export function isSuperAdminAuthenticated(): boolean {
  return !!getSuperAdminToken()
}
