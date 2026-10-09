import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Key, Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import Logo from '../../components/Logo'
import {
  createStaffRequest,
  deleteStaffRequest,
  fetchStaff,
  resetStaffMemberPasswordRequest,
  updateStaffRequest,
} from '../../lib/api'
import { clearToken, getToken } from '../../lib/auth'
import type { Role, StaffMember } from '../../types'

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrador',
  garcom: 'Garçom',
  cozinha: 'Cozinha',
}

const inputClass =
  'w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none'
const labelClass = 'mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft'

export default function AdminStaff() {
  const navigate = useNavigate()
  const token = getToken() ?? ''
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<Role>('garcom')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<Role>('garcom')

  const [passwordId, setPasswordId] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState('')

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const reload = () => {
    setLoading(true)
    fetchStaff(token)
      .then(setStaff)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }

  useEffect(reload, [token])

  useEffect(() => {
    if (!message) return
    const id = setTimeout(() => setMessage(null), 4000)
    return () => clearTimeout(id)
  }, [message])

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  const resetForm = () => {
    setUsername('')
    setDisplayName('')
    setRole('garcom')
    setPassword('')
    setError(null)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await createStaffRequest(token, { username, displayName, role, password })
      resetForm()
      setShowForm(false)
      setMessage(`Conta de ${displayName} criada.`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a conta.')
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (member: StaffMember) => {
    setEditingId(member.id)
    setEditName(member.displayName)
    setEditRole(member.role)
  }

  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingId) return
    try {
      await updateStaffRequest(token, editingId, { displayName: editName, role: editRole })
      setEditingId(null)
      setMessage('Dados atualizados.')
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.')
    }
  }

  const toggleActive = async (member: StaffMember) => {
    setError(null)
    try {
      await updateStaffRequest(token, member.id, { active: !member.active })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar.')
    }
  }

  const handleSavePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!passwordId) return
    try {
      await resetStaffMemberPasswordRequest(token, passwordId, newPassword)
      setPasswordId(null)
      setNewPassword('')
      setMessage('Senha atualizada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível trocar a senha.')
    }
  }

  const handleDelete = async (member: StaffMember) => {
    if (confirmDeleteId !== member.id) {
      setConfirmDeleteId(member.id)
      return
    }
    setError(null)
    try {
      await deleteStaffRequest(token, member.id)
      setConfirmDeleteId(null)
      setMessage(`Conta de ${member.displayName} removida.`)
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível remover.')
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Logo size="sm" to={null} />
          <h1 className="mt-1.5 font-display text-xl font-semibold text-ink md:text-2xl">Equipe</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-soft">
            {staff.length} {staff.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <UtensilsCrossed size={15} /> Cardápio
          </Link>
          <Link
            to="/admin/analytics"
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            <BarChart3 size={15} /> Relatórios
          </Link>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-semibold text-white hover:bg-accent/90"
          >
            <Plus size={16} /> Nova conta
          </button>
          <button
            onClick={handleLogout}
            className="flex min-h-11 items-center gap-1.5 rounded-full border border-border px-4 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            Sair
          </button>
        </div>
      </header>

      {message && (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-2.5 text-[12.5px] font-medium text-accent">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-xl bg-copper-soft px-4 py-2.5 text-[12.5px] font-medium text-copper">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 flex flex-col gap-3.5 rounded-2xl border border-border bg-surface p-5"
        >
          <h2 className="font-display text-base font-semibold text-ink">Nova conta</h2>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Nome da pessoa</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="ex: Rafaela"
                className={inputClass}
                required
              />
            </label>
            <label className="block">
              <span className={labelClass}>Usuário (login)</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex: rafaela"
                className={inputClass}
                required
              />
            </label>
          </div>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Papel</span>
              <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass}>
                <option value="garcom">Garçom</option>
                <option value="cozinha">Cozinha</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Senha inicial</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:opacity-60"
            >
              {saving ? 'Criando…' : 'Criar conta'}
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
          {staff.map((member) =>
            editingId === member.id ? (
              <form
                key={member.id}
                onSubmit={handleSaveEdit}
                className="flex flex-col gap-3 rounded-2xl border border-accent bg-surface p-4"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={labelClass}>Nome da pessoa</span>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Papel</span>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as Role)}
                      className={inputClass}
                    >
                      <option value="garcom">Garçom</option>
                      <option value="cozinha">Cozinha</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-white hover:bg-accent/90"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : passwordId === member.id ? (
              <form
                key={member.id}
                onSubmit={handleSavePassword}
                className="flex flex-col gap-3 rounded-2xl border border-accent bg-surface p-4 sm:flex-row sm:items-end"
              >
                <label className="block flex-1">
                  <span className={labelClass}>Nova senha para {member.displayName}</span>
                  <input
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    required
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[12.5px] font-semibold text-white hover:bg-accent/90"
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordId(null)
                      setNewPassword('')
                    }}
                    className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            ) : (
              <div
                key={member.id}
                className={`flex flex-col gap-3 rounded-2xl border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between ${
                  member.active ? 'border-border' : 'border-border opacity-60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-accent-soft font-display text-base font-semibold text-accent">
                    {member.displayName.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-[15px] font-medium text-ink">
                        {member.displayName}
                      </span>
                      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                        {ROLE_LABEL[member.role]}
                      </span>
                      {!member.active && (
                        <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                          Desativada
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-ink-soft">usuário: {member.username}</p>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    onClick={() => startEdit(member)}
                    aria-label={`Editar ${member.displayName}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => {
                      setPasswordId(member.id)
                      setNewPassword('')
                    }}
                    aria-label={`Trocar senha de ${member.displayName}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
                  >
                    <Key size={15} />
                  </button>
                  <button
                    onClick={() => toggleActive(member)}
                    className={`flex min-h-10 items-center justify-center rounded-full border px-3.5 text-[12.5px] font-semibold transition ${
                      member.active
                        ? 'border-danger/40 text-danger hover:bg-danger/10'
                        : 'border-accent text-accent hover:bg-accent-soft'
                    }`}
                  >
                    {member.active ? 'Desativar' : 'Reativar'}
                  </button>
                  <button
                    onClick={() => handleDelete(member)}
                    aria-label={`Excluir ${member.displayName}`}
                    className={`flex h-10 items-center justify-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition ${
                      confirmDeleteId === member.id
                        ? 'border-danger bg-danger/10 text-danger'
                        : 'border-border text-ink-soft hover:text-ink'
                    }`}
                  >
                    <Trash2 size={15} />
                    {confirmDeleteId === member.id && 'Confirmar'}
                  </button>
                </div>
              </div>
            ),
          )}

          {staff.length === 0 && (
            <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-ink-soft">
              Nenhuma conta cadastrada ainda.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
