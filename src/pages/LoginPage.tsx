import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock, LogIn } from 'lucide-react'
import Logo from '../components/Logo'
import { loginRequest } from '../lib/api'
import { getRole, homeRouteForRole, isAuthenticated, setToken } from '../lib/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (isAuthenticated()) {
    const role = getRole()
    return <Navigate to={role ? homeRouteForRole(role) : '/admin'} replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { token, role, displayName } = await loginRequest(username, password)
      setToken(token, role, displayName)
      navigate(homeRouteForRole(role), { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-5 py-14">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo size="md" to="/" />
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-6 shadow-sm"
        >
          <div className="mb-5 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Lock size={16} />
            </span>
            <div>
              <h1 className="font-display text-lg font-semibold text-ink">Acesso restrito</h1>
              <p className="text-[12px] text-ink-soft">Equipe do restaurante</p>
            </div>
          </div>

          <label className="mb-3 block">
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Usuário
            </span>
            <input
              id="username"
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
              id="password"
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

        <p className="mt-4 text-center text-[11.5px] text-ink-soft">
          Esqueceu a senha da equipe? Fale com o administrador do restaurante.
        </p>
      </div>
    </div>
  )
}
