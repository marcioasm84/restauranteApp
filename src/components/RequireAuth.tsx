import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { hasAccess, isAuthenticated } from '../lib/auth'
import type { Role } from '../types'

export default function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode
  roles: Role[]
}) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  if (!hasAccess(roles)) return <Navigate to="/login" replace />
  return children
}
