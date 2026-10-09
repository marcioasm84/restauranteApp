import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { isSuperAdminAuthenticated } from '../lib/auth'

export default function RequireSuperAdmin({ children }: { children: ReactNode }) {
  if (!isSuperAdminAuthenticated()) return <Navigate to="/super-admin/login" replace />
  return children
}
