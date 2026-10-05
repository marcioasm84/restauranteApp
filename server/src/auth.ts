import jwt from 'jsonwebtoken'

export type Role = 'admin' | 'garcom' | 'cozinha'

// One demo account per role — override via env vars in production. The
// admin role is treated as "can do everything" (see hasRole below), so it
// doesn't need to be listed alongside garçom/cozinha at each call site.
const ACCOUNTS: Record<Role, { username: string; password: string }> = {
  admin: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'mesaviva123',
  },
  garcom: {
    username: process.env.WAITER_USERNAME ?? 'garcom',
    password: process.env.WAITER_PASSWORD ?? 'garcom123',
  },
  cozinha: {
    username: process.env.KITCHEN_USERNAME ?? 'cozinha',
    password: process.env.KITCHEN_PASSWORD ?? 'cozinha123',
  },
}

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'

// Stateless sessions: the token itself carries the proof of login (signed),
// so any backend instance can verify it without sharing session state —
// unlike an in-memory token set, this survives restarts and scales to
// multiple instances behind a load balancer.
export function login(username: string, password: string): { token: string; role: Role } | null {
  const role = (Object.keys(ACCOUNTS) as Role[]).find(
    (r) => ACCOUNTS[r].username === username && ACCOUNTS[r].password === password,
  )
  if (!role) return null
  const token = jwt.sign({ sub: username, role }, JWT_SECRET, { expiresIn: '12h' })
  return { token, role }
}

export function getTokenRole(token: unknown): Role | null {
  if (typeof token !== 'string' || !token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { role?: Role }
    return payload.role ?? null
  } catch {
    return null
  }
}

export function isValidToken(token: unknown): token is string {
  return getTokenRole(token) !== null
}

// Admin can do everything; any other role only passes for actions that
// explicitly allow it.
export function hasRole(token: unknown, allowed: Role[]): boolean {
  const role = getTokenRole(token)
  if (!role) return false
  return role === 'admin' || allowed.includes(role)
}
