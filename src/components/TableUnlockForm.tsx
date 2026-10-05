import { useState, type FormEvent } from 'react'
import { Lock, LogIn } from 'lucide-react'
import type { RestaurantTable } from '../types'
import { loginRequest } from '../lib/api'
import { setUnlockedTableId } from '../lib/tableSession'

export default function TableUnlockForm({
  tableId,
  tableNumber,
  tables,
  onUnlocked,
}: {
  tableId?: string
  tableNumber?: number
  tables?: RestaurantTable[]
  onUnlocked: (tableId: string) => void
}) {
  const [selectedTableId, setSelectedTableId] = useState<string | null>(tableId ?? null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const selectedTable = tables?.find((t) => t.id === selectedTableId)
  const label = tableNumber ?? selectedTable?.number

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedTableId) return
    setError(null)
    setLoading(true)
    try {
      const { role } = await loginRequest(username, password)
      if (role !== 'garcom' && role !== 'admin') {
        setError('Esta conta não tem permissão para liberar mesas.')
        return
      }
      setUnlockedTableId(selectedTableId)
      onUnlocked(selectedTableId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível liberar a mesa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-accent-soft text-accent">
            <Lock size={16} />
          </span>
          <div>
            <h1 className="font-display text-lg font-semibold text-ink">
              {label ? `Liberar Mesa ${label}` : 'Liberar mesa'}
            </h1>
            <p className="text-[12px] text-ink-soft">Senha da equipe (garçom)</p>
          </div>
        </div>

        {!tableId && tables && (
          <div className="mb-5">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Qual mesa?
            </span>
            <div className="grid grid-cols-4 gap-2">
              {tables.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTableId(t.id)}
                  className={`flex aspect-square min-h-11 items-center justify-center rounded-lg border font-mono text-sm font-semibold transition ${
                    selectedTableId === t.id
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-border text-ink-soft hover:border-accent hover:text-accent'
                  }`}
                >
                  {t.number}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <label className="mb-3 block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Usuário
            </span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              required
            />
          </label>

          <label className="mb-5 block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Senha
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              required
            />
          </label>

          {error && (
            <p className="mb-4 rounded-lg bg-copper-soft px-3 py-2 text-[12.5px] font-medium text-copper">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !selectedTableId}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} />
            {loading ? 'Liberando…' : 'Liberar mesa'}
          </button>
        </form>
      </div>
    </div>
  )
}
