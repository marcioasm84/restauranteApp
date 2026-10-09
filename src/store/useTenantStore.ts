import { create } from 'zustand'
import { fetchTenantInfo } from '../lib/api'
import type { TenantBranding } from '../types'

interface TenantStoreState {
  branding: TenantBranding | null
  loading: boolean
  error: string | null
  load: () => void
}

function applyTheme(branding: TenantBranding) {
  document.title = branding.name
  const root = document.documentElement
  if (branding.primaryColor) root.style.setProperty('--accent', branding.primaryColor)
  if (branding.accentColor) root.style.setProperty('--copper', branding.accentColor)
}

export const useTenantStore = create<TenantStoreState>((set, get) => ({
  branding: null,
  loading: true,
  error: null,
  load: () => {
    if (!get().loading && get().branding) return
    set({ loading: true, error: null })
    fetchTenantInfo()
      .then((branding) => {
        applyTheme(branding)
        set({ branding, loading: false })
      })
      .catch((err) => {
        set({
          error: err instanceof Error ? err.message : 'Não foi possível identificar este restaurante.',
          loading: false,
        })
      })
  },
}))
