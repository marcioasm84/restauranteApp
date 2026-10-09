import { useEffect, useState, type ReactNode } from 'react'
import { MapPin, Store } from 'lucide-react'
import { fetchPublicTenants, resolveAssetUrl } from '../lib/api'
import { useTenantStore } from '../store/useTenantStore'
import type { PublicTenant } from '../types'

// Mirrors the backend's resolveTenantSlug (server/src/tenant.ts): true when
// the current host looks like it was trying to name a client (a subdomain
// that just doesn't match one), false for the bare platform domain.
function hasAttemptedSlug(): boolean {
  const hostname = window.location.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false
  const parts = hostname.split('.')
  if (parts.length >= 2 && parts[parts.length - 1] === 'localhost') return true
  return parts.length >= 3
}

function tenantUrl(slug: string): string {
  return `${window.location.protocol}//${slug}.${window.location.host}`
}

function TenantDirectory() {
  const [tenants, setTenants] = useState<PublicTenant[] | null>(null)

  useEffect(() => {
    fetchPublicTenants()
      .then(setTenants)
      .catch(() => setTenants([]))
  }, [])

  const attempted = hasAttemptedSlug()

  return (
    <div className="flex h-full flex-col items-center gap-3 overflow-y-auto px-6 py-10 text-center">
      <Store size={32} className="text-ink-soft" />
      <h1 className="font-display text-xl font-semibold text-ink">
        {attempted ? 'Restaurante não encontrado' : 'Escolha um restaurante'}
      </h1>
      <p className="max-w-sm text-sm text-ink-soft">
        {attempted
          ? 'Não encontramos nenhum restaurante com esse endereço. Talvez seja um destes:'
          : 'Acesse um dos restaurantes cadastrados na plataforma:'}
      </p>

      {tenants === null ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : tenants.length === 0 ? (
        <p className="max-w-sm text-sm text-ink-soft">Nenhum restaurante cadastrado ainda.</p>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-2.5 text-left">
          {tenants.map((t) => {
            const logo = resolveAssetUrl(t.logoUrl)
            return (
              <a
                key={t.slug}
                href={tenantUrl(t.slug)}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition hover:border-accent"
              >
                <span className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-black">
                  {logo ? (
                    <img src={logo} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Store size={18} className="text-white" />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-display text-[15px] font-medium text-ink">
                    {t.name}
                  </span>
                  {t.address && (
                    <span className="flex items-center gap-1 text-[12px] text-ink-soft">
                      <MapPin size={11} className="flex-none" />
                      <span className="truncate">{t.address}</span>
                    </span>
                  )}
                </span>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Wraps every tenant-scoped route: resolves which client this subdomain
// belongs to before rendering anything else, so the logo/name are right
// from the first paint. When no client resolves — the bare platform domain,
// or a subdomain that doesn't match anyone — it shows a directory of every
// registered client instead of a dead end.
export default function TenantGate({ children }: { children: ReactNode }) {
  const { branding, loading, error, load } = useTenantStore()

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Store size={28} className="animate-pulse text-ink-soft" />
      </div>
    )
  }

  if (error || !branding) {
    return <TenantDirectory />
  }

  return children
}
