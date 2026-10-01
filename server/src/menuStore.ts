import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.ts'
import { SEED_MENU } from './seedMenu.ts'
import type { MenuItem, MenuItemInput } from './types.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Old file-based store, from before the move to PostgreSQL — if it's still
// there (e.g. a project folder carried over from the previous phase), its
// contents are imported once on first boot instead of the static seed list,
// so any menu items added through the admin panel aren't lost in the move.
const LEGACY_MENU_FILE = join(__dirname, '..', 'data', 'menu.json')

function toDomain(row: {
  id: string
  name: string
  description: string
  price: number
  category: string
  image: string
  badges: string[]
  pontoCarne: string[]
  removiveis: string[]
}): MenuItem {
  const hasCustomization = row.pontoCarne.length > 0 || row.removiveis.length > 0
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    category: row.category,
    image: row.image,
    badges: row.badges as MenuItem['badges'],
    ...(hasCustomization
      ? {
          customization: {
            ...(row.pontoCarne.length ? { pontoCarne: row.pontoCarne } : {}),
            ...(row.removiveis.length ? { removiveis: row.removiveis } : {}),
          },
        }
      : {}),
  }
}

function loadLegacyMenu(): MenuItem[] | null {
  if (!existsSync(LEGACY_MENU_FILE)) return null
  try {
    const raw = readFileSync(LEGACY_MENU_FILE, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export async function ensureMenuSeeded() {
  const count = await prisma.menuItem.count()
  if (count > 0) return

  const source = loadLegacyMenu() ?? SEED_MENU
  for (const item of source) {
    await prisma.menuItem.create({
      data: {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image,
        badges: item.badges,
        pontoCarne: item.customization?.pontoCarne ?? [],
        removiveis: item.customization?.removiveis ?? [],
      },
    })
  }
  console.log(
    `[menu] semeado com ${source.length} itens (${source === SEED_MENU ? 'catálogo padrão' : 'menu.json existente'})`,
  )
}

export async function getMenu(): Promise<MenuItem[]> {
  const rows = await prisma.menuItem.findMany({ orderBy: { category: 'asc' } })
  return rows.map(toDomain)
}

export async function getMenuItem(id: string): Promise<MenuItem | undefined> {
  const row = await prisma.menuItem.findUnique({ where: { id } })
  return row ? toDomain(row) : undefined
}

export async function createMenuItem(input: MenuItemInput): Promise<MenuItem> {
  const row = await prisma.menuItem.create({
    data: {
      name: input.name,
      description: input.description,
      price: input.price,
      category: input.category,
      image: input.image,
      badges: input.badges,
      pontoCarne: input.customization?.pontoCarne ?? [],
      removiveis: input.customization?.removiveis ?? [],
    },
  })
  return toDomain(row)
}

export async function updateMenuItem(
  id: string,
  patch: Partial<MenuItemInput>,
): Promise<MenuItem | null> {
  try {
    const row = await prisma.menuItem.update({
      where: { id },
      data: {
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.price !== undefined ? { price: patch.price } : {}),
        ...(patch.category !== undefined ? { category: patch.category } : {}),
        ...(patch.image !== undefined ? { image: patch.image } : {}),
        ...(patch.badges !== undefined ? { badges: patch.badges } : {}),
        ...(patch.customization !== undefined
          ? {
              pontoCarne: patch.customization?.pontoCarne ?? [],
              removiveis: patch.customization?.removiveis ?? [],
            }
          : {}),
      },
    })
    return toDomain(row)
  } catch {
    return null
  }
}

export async function deleteMenuItem(id: string): Promise<boolean> {
  try {
    await prisma.menuItem.delete({ where: { id } })
    return true
  } catch {
    return false
  }
}
