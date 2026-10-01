import { create } from 'zustand'
import { socket } from '../lib/socket'
import { getToken } from '../lib/auth'
import { MENU } from '../data/menu'
import type { MenuItem } from '../types'

type MenuItemInput = Omit<MenuItem, 'id'>

function categoriesOf(items: MenuItem[]): string[] {
  return Array.from(new Set(items.map((i) => i.category)))
}

interface MenuStoreState {
  items: MenuItem[]
  categories: string[]
  lastError: string | null
  createMenuItem: (item: MenuItemInput) => void
  updateMenuItem: (id: string, item: Partial<MenuItemInput>) => void
  deleteMenuItem: (id: string) => void
  clearError: () => void
}

export const useMenuStore = create<MenuStoreState>((set) => {
  socket.onMessage((msg) => {
    if (msg.type === 'menu') {
      set({ items: msg.items, categories: categoriesOf(msg.items) })
    }
    if (msg.type === 'error') {
      set({ lastError: msg.message })
    }
  })
  socket.start()

  return {
    // Bundled fallback so the menu renders instantly before the server's
    // first 'menu' message arrives; the server is the source of truth.
    items: MENU,
    categories: categoriesOf(MENU),
    lastError: null,

    createMenuItem: (item) =>
      socket.send({ type: 'createMenuItem', token: getToken() ?? '', item }),
    updateMenuItem: (id, item) =>
      socket.send({ type: 'updateMenuItem', token: getToken() ?? '', id, item }),
    deleteMenuItem: (id) => socket.send({ type: 'deleteMenuItem', token: getToken() ?? '', id }),
    clearError: () => set({ lastError: null }),
  }
})
