import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { prisma } from './db.ts'
import type { StaffRole } from '@prisma/client'

export interface TenantSummary {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  responsibleName: string | null
  phone: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  status: string
  plan: string
  createdAt: number
  tableCount: number
  menuItemCount: number
  orderCount: number
}

function toSummary(row: {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  primaryColor: string | null
  accentColor: string | null
  responsibleName: string | null
  phone: string | null
  email: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  status: string
  plan: string
  createdAt: Date
  _count: { tables: number; menuItems: number; orders: number }
}): TenantSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logoUrl,
    primaryColor: row.primaryColor,
    accentColor: row.accentColor,
    responsibleName: row.responsibleName,
    phone: row.phone,
    email: row.email,
    address: row.address,
    latitude: row.latitude,
    longitude: row.longitude,
    notes: row.notes,
    status: row.status,
    plan: row.plan,
    createdAt: row.createdAt.getTime(),
    tableCount: row._count.tables,
    menuItemCount: row._count.menuItems,
    orderCount: row._count.orders,
  }
}

export async function listTenants(): Promise<TenantSummary[]> {
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { tables: true, menuItems: true, orders: true } } },
  })
  return rows.map(toSummary)
}

export async function getTenantById(id: string) {
  return prisma.tenant.findUnique({ where: { id } })
}

export interface PublicTenant {
  name: string
  slug: string
  logoUrl: string | null
  address: string | null
}

// Powers the "choose a restaurant" directory the frontend shows when no
// tenant resolves from the current host — unauthenticated, so only the
// handful of fields meant to be public (no contact info, no counts) and
// suspended clients left out.
export async function listPublicTenants(): Promise<PublicTenant[]> {
  return prisma.tenant.findMany({
    where: { status: { not: 'suspended' } },
    select: { name: true, slug: true, logoUrl: true, address: true },
    orderBy: { name: 'asc' },
  })
}

const TABLE_COUNT_DEFAULT = 8

export interface TenantContactInput {
  logoUrl?: string | null
  primaryColor?: string
  accentColor?: string
  responsibleName?: string
  phone?: string
  email?: string
  address?: string
  latitude?: number
  longitude?: number
  notes?: string
}

// Creates a brand-new client: the tenant row, its initial set of tables,
// and one login per staff role (admin/garçom/cozinha) with the given
// passwords, hashed — nothing is seeded into the menu, that starts empty
// and is built through that tenant's own admin panel.
export async function createTenant(
  input: TenantContactInput & {
    name: string
    slug: string
    tableCount?: number
    staff: { admin: string; garcom: string; cozinha: string }
  },
) {
  const tenant = await prisma.tenant.create({
    data: {
      name: input.name,
      slug: input.slug,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      accentColor: input.accentColor,
      responsibleName: input.responsibleName,
      phone: input.phone,
      email: input.email,
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      notes: input.notes,
    },
  })

  const tableCount = input.tableCount ?? TABLE_COUNT_DEFAULT
  for (let i = 1; i <= tableCount; i++) {
    await prisma.restaurantTable.create({
      data: {
        id: `${tenant.id}-${i}`,
        tenantId: tenant.id,
        number: i,
        status: 'livre',
        callingWaiter: false,
        requestingBill: false,
      },
    })
  }

  await createStaffUser(tenant.id, 'admin', input.staff.admin)
  await createStaffUser(tenant.id, 'garcom', input.staff.garcom)
  await createStaffUser(tenant.id, 'cozinha', input.staff.cozinha)

  return tenant
}

export async function updateTenant(
  id: string,
  patch: Partial<TenantContactInput> & {
    name?: string
    status?: 'trial' | 'active' | 'past_due' | 'suspended'
    plan?: string
  },
) {
  return prisma.tenant.update({ where: { id }, data: patch })
}

const DEFAULT_DISPLAY_NAME: Record<StaffRole, string> = {
  admin: 'Administrador',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
}

async function createStaffUser(tenantId: string, role: StaffRole, password: string) {
  const username = role
  const passwordHash = await bcrypt.hash(password, 10)
  return prisma.tenantUser.create({
    data: { tenantId, username, role, passwordHash, displayName: DEFAULT_DISPLAY_NAME[role] },
  })
}

export async function verifyStaffLogin(
  tenantId: string,
  username: string,
  password: string,
): Promise<{ id: string; role: StaffRole; displayName: string } | null> {
  const user = await prisma.tenantUser.findUnique({
    where: { tenantId_username: { tenantId, username } },
  })
  if (!user || !user.active) return null
  const ok = await bcrypt.compare(password, user.passwordHash)
  if (!ok) return null
  return { id: user.id, role: user.role, displayName: user.displayName ?? DEFAULT_DISPLAY_NAME[user.role] }
}

export async function setStaffPassword(tenantId: string, role: StaffRole, password: string) {
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.tenantUser.update({
    where: { tenantId_username: { tenantId, username: role } },
    data: { passwordHash },
  })
}

// --- Equipe (contas individuais de garçom/cozinha/admin, Fase 8) -----------
// Distinct from the 3 fixed accounts above (still created per-tenant at
// signup) — this is the CRUD the tenant's own admin uses to add more staff
// beyond those defaults, each with their own name/username/password.

export interface StaffSummary {
  id: string
  username: string
  displayName: string
  role: StaffRole
  active: boolean
  createdAt: number
}

function toStaffSummary(row: {
  id: string
  username: string
  displayName: string | null
  role: StaffRole
  active: boolean
  createdAt: Date
}): StaffSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName ?? DEFAULT_DISPLAY_NAME[row.role],
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.getTime(),
  }
}

export async function listStaffUsers(tenantId: string): Promise<StaffSummary[]> {
  const rows = await prisma.tenantUser.findMany({
    where: { tenantId },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
  })
  return rows.map(toStaffSummary)
}

export async function createStaffMember(
  tenantId: string,
  input: { username: string; displayName: string; role: StaffRole; password: string },
): Promise<StaffSummary> {
  const passwordHash = await bcrypt.hash(input.password, 10)
  const row = await prisma.tenantUser.create({
    data: {
      tenantId,
      username: input.username,
      displayName: input.displayName,
      role: input.role,
      passwordHash,
    },
  })
  return toStaffSummary(row)
}

export async function updateStaffMember(
  tenantId: string,
  id: string,
  patch: { displayName?: string; role?: StaffRole; active?: boolean },
): Promise<StaffSummary> {
  const existing = await prisma.tenantUser.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Conta não encontrada')
  // Deactivating the last admin would lock the tenant out of its own panel.
  if (patch.active === false && existing.role === 'admin') {
    const otherActiveAdmins = await prisma.tenantUser.count({
      where: { tenantId, role: 'admin', active: true, id: { not: id } },
    })
    if (otherActiveAdmins === 0) {
      throw new Error('Não é possível desativar o único administrador do restaurante')
    }
  }
  const row = await prisma.tenantUser.update({
    where: { id },
    data: {
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    },
  })
  return toStaffSummary(row)
}

export async function setStaffMemberPassword(tenantId: string, id: string, password: string) {
  const existing = await prisma.tenantUser.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Conta não encontrada')
  const passwordHash = await bcrypt.hash(password, 10)
  await prisma.tenantUser.update({ where: { id }, data: { passwordHash } })
}

export async function removeStaffMember(tenantId: string, id: string): Promise<void> {
  const existing = await prisma.tenantUser.findFirst({ where: { id, tenantId } })
  if (!existing) throw new Error('Conta não encontrada')
  if (existing.role === 'admin') {
    const otherAdmins = await prisma.tenantUser.count({
      where: { tenantId, role: 'admin', id: { not: id } },
    })
    if (otherAdmins === 0) {
      throw new Error('Não é possível remover o único administrador do restaurante')
    }
  }
  await prisma.tenantUser.delete({ where: { id } })
}

function randomPassword(): string {
  return randomBytes(6).toString('base64url')
}

// Generates a fresh password for every staff role on this tenant and
// returns them in plain text — the only moment they ever exist outside a
// bcrypt hash, so the caller must use them immediately (send by email) and
// then let them go out of scope.
export async function resetStaffPasswords(
  tenantId: string,
): Promise<{ admin: string; garcom: string; cozinha: string }> {
  const credentials = { admin: randomPassword(), garcom: randomPassword(), cozinha: randomPassword() }
  await setStaffPassword(tenantId, 'admin', credentials.admin)
  await setStaffPassword(tenantId, 'garcom', credentials.garcom)
  await setStaffPassword(tenantId, 'cozinha', credentials.cozinha)
  return credentials
}
