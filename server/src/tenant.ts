import type { NextFunction, Request, Response } from 'express'
import { prisma } from './db.ts'

export interface TenantInfo {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  status: string
}

// Pulls the client's slug out of the Host header. "barxyz.localhost:5173"
// and "barxyz.meurestaurante.app" both yield "barxyz"; a bare "localhost"
// or the platform's own apex domain ("meurestaurante.app", 2 labels, not
// ending in ".localhost") yields null — that's the platform root, used for
// the Super Admin area, not for any one client.
export function resolveTenantSlug(hostHeader: string | undefined | null): string | null {
  if (!hostHeader) return null
  const hostname = hostHeader.split(':')[0].toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null
  const parts = hostname.split('.')
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') {
    return parts[0]
  }
  if (parts.length >= 3) return parts[0]
  return null
}

export async function getTenantBySlug(slug: string): Promise<TenantInfo | null> {
  const row = await prisma.tenant.findUnique({ where: { slug } })
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    status: row.status,
  }
}

// Express middleware: resolves the tenant from the request's Host header
// and attaches it to req.tenant. Routes that need a tenant (login, state,
// analytics, ...) reject with 404 if none resolves; Super Admin routes
// don't use this at all — they're mounted before it runs.
declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantInfo
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const slug = resolveTenantSlug(req.header('host'))
  if (!slug) {
    res.status(404).json({ message: 'Nenhum cliente identificado nesta URL' })
    return
  }
  const tenant = await getTenantBySlug(slug)
  if (!tenant) {
    res.status(404).json({ message: 'Cliente não encontrado' })
    return
  }
  req.tenant = tenant
  next()
}
