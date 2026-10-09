import { prisma } from './db.ts'
import type { MenuItem, MenuItemInput } from './types.ts'

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

export async function getMenu(tenantId: string): Promise<MenuItem[]> {
  const rows = await prisma.menuItem.findMany({ where: { tenantId }, orderBy: { category: 'asc' } })
  return rows.map(toDomain)
}

export async function getMenuItem(tenantId: string, id: string): Promise<MenuItem | undefined> {
  const row = await prisma.menuItem.findFirst({ where: { id, tenantId } })
  return row ? toDomain(row) : undefined
}

export async function createMenuItem(tenantId: string, input: MenuItemInput): Promise<MenuItem> {
  const row = await prisma.menuItem.create({
    data: {
      tenantId,
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
  tenantId: string,
  id: string,
  patch: Partial<MenuItemInput>,
): Promise<MenuItem | null> {
  const existing = await prisma.menuItem.findFirst({ where: { id, tenantId } })
  if (!existing) return null
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
}

export async function deleteMenuItem(tenantId: string, id: string): Promise<boolean> {
  const existing = await prisma.menuItem.findFirst({ where: { id, tenantId } })
  if (!existing) return false
  await prisma.menuItem.delete({ where: { id } })
  return true
}
