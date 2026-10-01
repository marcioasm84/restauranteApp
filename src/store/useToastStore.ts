import { create } from 'zustand'

interface Toast {
  id: string
  message: string
}

interface ToastStoreState {
  toasts: Toast[]
  push: (message: string) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],
  push: (message) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 5000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
