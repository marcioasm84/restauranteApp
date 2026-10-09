import jwt from 'jsonwebtoken'
import { verifyStaffLogin } from './tenantStore.ts'

export type Role = 'admin' | 'garcom' | 'cozinha'

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'

const SUPER_ADMIN_USERNAME = process.env.SUPER_ADMIN_USERNAME ?? 'superadmin'
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD ?? 'superadmin123'

interface StaffPayload {
  sub: string
  uid: string
  name: string
  role: Role
  tenantId: string
}

interface SuperAdminPayload {
  sub: string
  role: 'super_admin'
}

// Stateless sessions: the token itself carries the proof of login (signed),
// so any backend instance can verify it without sharing session state —
// survives restarts and scales to multiple instances behind a load
// balancer. A staff token is scoped to exactly one tenant (tenantId), so
// it's useless against any other client's subdomain even if somehow
// replayed there — see hasRole below.
export async function login(
  tenantId: string,
  username: string,
  password: string,
): Promise<{ token: string; role: Role; displayName: string } | null> {
  const result = await verifyStaffLogin(tenantId, username, password)
  if (!result) return null
  const payload: StaffPayload = {
    sub: username,
    uid: result.id,
    name: result.displayName,
    role: result.role,
    tenantId,
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
  return { token, role: result.role, displayName: result.displayName }
}

export function superAdminLogin(username: string, password: string): string | null {
  if (username !== SUPER_ADMIN_USERNAME || password !== SUPER_ADMIN_PASSWORD) return null
  const payload: SuperAdminPayload = { sub: username, role: 'super_admin' }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' })
}

function decode(token: unknown): StaffPayload | SuperAdminPayload | null {
  if (typeof token !== 'string' || !token) return null
  try {
    return jwt.verify(token, JWT_SECRET) as StaffPayload | SuperAdminPayload
  } catch {
    return null
  }
}

export function isValidToken(token: unknown): token is string {
  return decode(token) !== null
}

// A staff token only ever passes for the tenant it was issued for. Admin
// can do everything *within that tenant*; any other role only passes for
// actions that explicitly allow it. Super admin tokens never pass here —
// they're checked separately via isSuperAdmin, since the platform area
// isn't scoped to any one tenant.
export function hasRole(token: unknown, tenantId: string, allowed: Role[]): boolean {
  const payload = decode(token)
  if (!payload || payload.role === 'super_admin') return false
  if (payload.tenantId !== tenantId) return false
  return payload.role === 'admin' || allowed.includes(payload.role)
}

// Who (if anyone) is behind a WebSocket action, for attribution on
// Order/Bill — e.g. "qual garçom lançou este pedido". Returns null for a
// missing/invalid/wrong-tenant token without throwing: customer devices
// never send a token here, and that's a normal, valid case, not an error.
export function getStaffIdentity(
  token: unknown,
  tenantId: string,
): { id: string; name: string; role: Role } | null {
  const payload = decode(token)
  if (!payload || payload.role === 'super_admin') return null
  if (payload.tenantId !== tenantId) return null
  return { id: payload.uid, name: payload.name, role: payload.role }
}

export function isSuperAdmin(token: unknown): boolean {
  const payload = decode(token)
  return payload?.role === 'super_admin'
}
