import jwt from 'jsonwebtoken'

// Single admin account for this demo — override via env vars in production.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'mesaviva123'
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me'

// Stateless sessions: the token itself carries the proof of login (signed),
// so any backend instance can verify it without sharing session state —
// unlike an in-memory token set, this survives restarts and scales to
// multiple instances behind a load balancer.
export function login(username: string, password: string): string | null {
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    return jwt.sign({ sub: 'admin' }, JWT_SECRET, { expiresIn: '12h' })
  }
  return null
}

export function isValidToken(token: unknown): token is string {
  if (typeof token !== 'string' || !token) return false
  try {
    jwt.verify(token, JWT_SECRET)
    return true
  } catch {
    return false
  }
}
