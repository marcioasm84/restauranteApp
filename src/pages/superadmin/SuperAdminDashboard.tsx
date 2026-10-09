import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Mail, MapPin, Pencil, Plus, ShieldCheck, Store, Upload, X } from 'lucide-react'
import {
  createTenantRequest,
  fetchTenants,
  resendCredentialsRequest,
  resolveAssetUrl,
  updateTenantRequest,
  uploadLogoRequest,
} from '../../lib/api'
import { clearSuperAdminToken, getSuperAdminToken } from '../../lib/auth'
import MapPickerModal from '../../components/MapPickerModal'
import type { TenantSummary } from '../../types'

const STATUS_LABEL: Record<TenantSummary['status'], string> = {
  trial: 'Em teste',
  active: 'Ativo',
  past_due: 'Pagamento atrasado',
  suspended: 'Suspenso',
}

const STATUS_STYLE: Record<TenantSummary['status'], string> = {
  trial: 'bg-accent-soft text-accent',
  active: 'bg-accent-soft text-accent',
  past_due: 'bg-copper-soft text-copper',
  suspended: 'bg-danger/10 text-danger',
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const inputClass =
  'w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none'
const labelClass = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft'

interface ContactFields {
  responsibleName: string
  phone: string
  email: string
  address: string
  latitude: string
  longitude: string
  notes: string
}

function emptyContact(): ContactFields {
  return { responsibleName: '', phone: '', email: '', address: '', latitude: '', longitude: '', notes: '' }
}

function contactFromTenant(t: TenantSummary): ContactFields {
  return {
    responsibleName: t.responsibleName ?? '',
    phone: t.phone ?? '',
    email: t.email ?? '',
    address: t.address ?? '',
    latitude: t.latitude != null ? String(t.latitude) : '',
    longitude: t.longitude != null ? String(t.longitude) : '',
    notes: t.notes ?? '',
  }
}

function LogoUploadField({
  token,
  value,
  onChange,
}: {
  token: string
  value: string
  onChange: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preview = resolveAssetUrl(value)

  const handleFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      onChange(await uploadLogoRequest(token, file))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="block">
      <span className={labelClass}>Logo</span>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 flex-none items-center justify-center overflow-hidden rounded-full bg-black">
          {preview ? (
            <img src={preview} alt="" className="h-full w-full object-cover" />
          ) : (
            <Store size={20} className="text-white" />
          )}
        </div>
        <label className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
          <Upload size={14} />
          {uploading ? 'Enviando…' : value ? 'Trocar imagem' : 'Escolher imagem'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) handleFile(file)
            }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-[12.5px] font-semibold text-ink-soft hover:text-danger"
          >
            Remover
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] font-medium text-danger">{error}</p>}
    </div>
  )
}

function ContactFieldset({
  token,
  value,
  onChange,
}: {
  token: string
  value: ContactFields
  onChange: (next: ContactFields) => void
}) {
  const set = <K extends keyof ContactFields>(key: K, v: ContactFields[K]) =>
    onChange({ ...value, [key]: v })

  const [showPicker, setShowPicker] = useState(false)
  const lat = Number(value.latitude)
  const lng = Number(value.longitude)
  const hasCoords = value.latitude.trim() !== '' && value.longitude.trim() !== '' && Number.isFinite(lat) && Number.isFinite(lng)

  return (
    <>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Nome do responsável</span>
          <input
            value={value.responsibleName}
            onChange={(e) => set('responsibleName', e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Telefone</span>
          <input
            value={value.phone}
            onChange={(e) => set('phone', e.target.value)}
            placeholder="(11) 99999-9999"
            className={inputClass}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>E-mail de contato</span>
        <input
          type="email"
          value={value.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="contato@restaurante.com.br"
          className={inputClass}
        />
        <span className="mt-1 block text-[11px] text-ink-soft">
          É para cá que vão o login e a senha quando o cliente é cadastrado.
        </span>
      </label>

      <label className="block">
        <span className={labelClass}>Endereço</span>
        <input
          value={value.address}
          onChange={(e) => set('address', e.target.value)}
          className={inputClass}
        />
      </label>

      <div className="grid gap-3.5 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Latitude</span>
          <input
            value={value.latitude}
            onChange={(e) => set('latitude', e.target.value)}
            placeholder="-23.5505"
            inputMode="decimal"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Longitude</span>
          <input
            value={value.longitude}
            onChange={(e) => set('longitude', e.target.value)}
            placeholder="-46.6333"
            inputMode="decimal"
            className={inputClass}
          />
        </label>
      </div>

      <div className="-mt-1.5">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex min-h-9 w-fit items-center gap-1.5 rounded-full border border-border px-3.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
        >
          <MapPin size={13} /> {hasCoords ? 'Ajustar ponto no mapa' : 'Marcar localização no mapa'}
        </button>
      </div>

      {showPicker && (
        <MapPickerModal
          token={token}
          address={value.address}
          initialLat={hasCoords ? lat : null}
          initialLng={hasCoords ? lng : null}
          onConfirm={(newLat, newLng) => {
            onChange({ ...value, latitude: newLat.toFixed(6), longitude: newLng.toFixed(6) })
            setShowPicker(false)
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {value.address && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(value.address)}`}
          target="_blank"
          rel="noreferrer"
          className="-mt-2 flex w-fit items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
        >
          <MapPin size={12} /> Abrir endereço no Google Maps
        </a>
      )}

      {hasCoords && (
        <div className="-mt-1 flex flex-col gap-2">
          <div className="overflow-hidden rounded-xl border border-border">
            <iframe
              title="Localização no mapa"
              src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
              width="100%"
              height="220"
              style={{ border: 0, display: 'block' }}
              loading="lazy"
            />
          </div>
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-1 text-[12px] font-semibold text-accent hover:underline"
          >
            <MapPin size={12} /> Abrir coordenadas no Google Maps
          </a>
        </div>
      )}

      <label className="block">
        <span className={labelClass}>Notas internas (só a plataforma vê)</span>
        <textarea
          value={value.notes}
          onChange={(e) => set('notes', e.target.value)}
          rows={2}
          className={inputClass}
        />
      </label>
    </>
  )
}

export default function SuperAdminDashboard() {
  const navigate = useNavigate()
  const token = getSuperAdminToken() ?? ''
  const [tenants, setTenants] = useState<TenantSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [logoUrl, setLogoUrl] = useState('')
  const [contact, setContact] = useState<ContactFields>(emptyContact())
  const [adminPassword, setAdminPassword] = useState('')
  const [garcomPassword, setGarcomPassword] = useState('')
  const [cozinhaPassword, setCozinhaPassword] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editContact, setEditContact] = useState<ContactFields>(emptyContact())
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetchTenants(token)
      .then(setTenants)
      .catch(() => setTenants([]))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [token])

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(id)
  }, [message])

  const handleLogout = () => {
    clearSuperAdminToken()
    navigate('/super-admin/login', { replace: true })
  }

  const resetForm = () => {
    setName('')
    setSlug('')
    setSlugEdited(false)
    setLogoUrl('')
    setContact(emptyContact())
    setAdminPassword('')
    setGarcomPassword('')
    setCozinhaPassword('')
    setFormError(null)
  }

  const contactPayload = (c: ContactFields) => ({
    responsibleName: c.responsibleName.trim() || undefined,
    phone: c.phone.trim() || undefined,
    email: c.email.trim() || undefined,
    address: c.address.trim() || undefined,
    latitude: c.latitude.trim() ? Number(c.latitude) : undefined,
    longitude: c.longitude.trim() ? Number(c.longitude) : undefined,
    notes: c.notes.trim() || undefined,
  })

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      await createTenantRequest(token, {
        name,
        slug,
        logoUrl: logoUrl.trim() || null,
        ...contactPayload(contact),
        staff: { admin: adminPassword, garcom: garcomPassword, cozinha: cozinhaPassword },
      })
      resetForm()
      setShowForm(false)
      setMessage(
        contact.email
          ? 'Cliente criado — credenciais enviadas por e-mail.'
          : 'Cliente criado. Cadastre um e-mail para poder enviar as credenciais.',
      )
      reload()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar o cliente.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (t: TenantSummary) => {
    setEditingId(t.id)
    setEditName(t.name)
    setEditLogoUrl(t.logoUrl ?? '')
    setEditContact(contactFromTenant(t))
    setEditError(null)
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    setEditError(null)
    setEditSaving(true)
    try {
      await updateTenantRequest(token, editingId, {
        name: editName,
        logoUrl: editLogoUrl.trim() || null,
        ...contactPayload(editContact),
      })
      setEditingId(null)
      setMessage('Dados do cliente atualizados.')
      reload()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setEditSaving(false)
    }
  }

  const toggleStatus = async (tenant: TenantSummary) => {
    const nextStatus = tenant.status === 'suspended' ? 'active' : 'suspended'
    await updateTenantRequest(token, tenant.id, { status: nextStatus })
    reload()
  }

  const handleResend = async (tenant: TenantSummary) => {
    setMessage(null)
    try {
      await resendCredentialsRequest(token, tenant.id)
      setMessage(`Novas senhas geradas e enviadas para ${tenant.email}.`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Não foi possível reenviar.')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck size={19} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink md:text-2xl">
              Meu Restaurante — Plataforma
            </h1>
            <p className="text-[12.5px] text-ink-soft">
              {tenants.length} {tenants.length === 1 ? 'cliente cadastrado' : 'clientes cadastrados'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent/90"
          >
            <Plus size={16} /> Novo cliente
          </button>
          <button
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      {message && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-2.5 text-[12.5px] font-medium text-accent">
          {message}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="font-display text-base font-semibold text-ink">Cadastrar novo cliente</h2>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Nome do restaurante</span>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (!slugEdited) setSlug(slugify(e.target.value))
                }}
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Subdomínio (slug)</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value))
                  setSlugEdited(true)
                }}
                placeholder="ex: barxyz"
                className={inputClass}
                required
              />
            </label>
          </div>

          <LogoUploadField token={token} value={logoUrl} onChange={setLogoUrl} />

          <div className="my-1 h-px bg-border" />
          <p className="-mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Contato e localização
          </p>
          <ContactFieldset token={token} value={contact} onChange={setContact} />

          <div className="my-1 h-px bg-border" />
          <p className="-mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Senhas iniciais da equipe
          </p>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Senha do admin</span>
              <input
                type="text"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Senha do garçom</span>
              <input
                type="text"
                value={garcomPassword}
                onChange={(e) => setGarcomPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Senha da cozinha</span>
              <input
                type="text"
                value={cozinhaPassword}
                onChange={(e) => setCozinhaPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>

          {formError && (
            <p className="rounded-lg bg-copper-soft px-3 py-2 text-[12.5px] font-medium text-copper">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {saving ? 'Criando…' : 'Criar cliente'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-5 text-[13px] font-semibold text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Carregando…</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {tenants.map((t) =>
            editingId === t.id ? (
              <form
                key={t.id}
                onSubmit={handleSaveEdit}
                className="flex flex-col gap-3.5 rounded-2xl border border-accent bg-surface p-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-semibold text-ink">Editar {t.name}</h3>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:text-ink"
                  >
                    <X size={16} />
                  </button>
                </div>

                <label className="block">
                  <span className={labelClass}>Nome do restaurante</span>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>

                <LogoUploadField token={token} value={editLogoUrl} onChange={setEditLogoUrl} />

                <ContactFieldset token={token} value={editContact} onChange={setEditContact} />

                {editError && (
                  <p className="rounded-lg bg-copper-soft px-3 py-2 text-[12.5px] font-medium text-copper">
                    {editError}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={editSaving}
                    className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
                  >
                    {editSaving ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-5 text-[13px] font-semibold text-ink-soft hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div
                key={t.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-none items-center justify-center overflow-hidden rounded-full bg-black">
                    {resolveAssetUrl(t.logoUrl) ? (
                      <img src={resolveAssetUrl(t.logoUrl)!} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Store size={18} className="text-white" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-medium text-ink">{t.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[t.status]}`}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                    <p className="text-[12px] text-ink-soft">
                      {t.slug}.meurestaurante.app · {t.tableCount} mesas · {t.menuItemCount} itens no
                      cardápio · {t.orderCount} pedidos
                    </p>
                    {(t.responsibleName || t.phone || t.email) && (
                      <p className="text-[12px] text-ink-soft">
                        {[t.responsibleName, t.phone, t.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {t.latitude != null && t.longitude != null && (
                      <a
                        href={`https://www.google.com/maps?q=${t.latitude},${t.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-0.5 flex w-fit items-center gap-1 text-[11.5px] font-semibold text-accent hover:underline"
                      >
                        <MapPin size={11} /> Ver no mapa
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    onClick={() => startEdit(t)}
                    aria-label={`Editar ${t.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => handleResend(t)}
                    disabled={!t.email}
                    aria-label={`Reenviar credenciais para ${t.name}`}
                    title={t.email ? 'Gerar novas senhas e reenviar por e-mail' : 'Cadastre um e-mail primeiro'}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Mail size={15} />
                  </button>
                  <button
                    onClick={() => toggleStatus(t)}
                    className={`flex min-h-10 items-center justify-center rounded-full border px-4 text-[12.5px] font-semibold transition ${
                      t.status === 'suspended'
                        ? 'border-accent text-accent hover:bg-accent-soft'
                        : 'border-danger/40 text-danger hover:bg-danger/10'
                    }`}
                  >
                    {t.status === 'suspended' ? 'Reativar' : 'Suspender'}
                  </button>
                </div>
              </div>
            ),
          )}

          {tenants.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
              Nenhum cliente cadastrado ainda.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
