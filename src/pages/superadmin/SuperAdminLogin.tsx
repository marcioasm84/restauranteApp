import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ShieldCheck, LogIn } from 'lucide-react'
import { superAdminLoginRequest } from '../../lib/api'
import { isSuperAdminAuthenticated, setSuperAdminToken } from '../../lib/auth'

export default function SuperAdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isSuperAdminAuthenticated()) return <Navigate to="/super-admin" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const token = await superAdminLoginRequest(username, password)
      setSuperAdminToken(token)
      navigate('/super-admin', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-bg px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ShieldCheck size={22} />
          </span>
          <h1 className="font-display text-xl font-semibold text-ink">Meu Restaurante</h1>
          <p className="text-[12.5px] text-ink-soft">Painel da plataforma — área restrita</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
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
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <LogIn size={16} />
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
