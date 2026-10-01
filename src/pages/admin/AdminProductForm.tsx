import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import Logo from '../../components/Logo'
import DishImage from '../../components/DishImage'
import { useMenuStore } from '../../store/useMenuStore'
import { BADGE_LABEL } from '../../data/menu'
import type { Badge } from '../../types'

const ALL_BADGES: Badge[] = ['vegetariano', 'sem-gluten', 'picante', 'mais-pedido', 'novo']

export default function AdminProductForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const items = useMenuStore((s) => s.items)
  const categories = useMenuStore((s) => s.categories)
  const createMenuItem = useMenuStore((s) => s.createMenuItem)
  const updateMenuItem = useMenuStore((s) => s.updateMenuItem)

  const existing = useMemo(() => items.find((i) => i.id === id), [items, id])
  if (isEditing && !existing) return <Navigate to="/admin" replace />

  const [name, setName] = useState(existing?.name ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [price, setPrice] = useState(existing ? String(existing.price) : '')
  const [category, setCategory] = useState(existing?.category ?? categories[0] ?? '')
  const [image, setImage] = useState(existing?.image ?? '')
  const [badges, setBadges] = useState<Badge[]>(existing?.badges ?? [])
  const [pontoCarne, setPontoCarne] = useState(
    existing?.customization?.pontoCarne?.join(', ') ?? '',
  )
  const [removiveis, setRemoviveis] = useState(
    existing?.customization?.removiveis?.join(', ') ?? '',
  )

  const toggleBadge = (b: Badge) =>
    setBadges((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]))

  const parseList = (value: string) =>
    value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const pontoCarneList = parseList(pontoCarne)
    const removiveisList = parseList(removiveis)
    const customization =
      pontoCarneList.length || removiveisList.length
        ? {
            ...(pontoCarneList.length ? { pontoCarne: pontoCarneList } : {}),
            ...(removiveisList.length ? { removiveis: removiveisList } : {}),
          }
        : undefined

    const item = {
      name: name.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      category: category.trim(),
      image: image.trim(),
      badges,
      customization,
    }

    if (isEditing && id) {
      updateMenuItem(id, item)
    } else {
      createMenuItem(item)
    }
    navigate('/admin')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/admin"
          className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-border text-ink-soft hover:text-ink"
          aria-label="Voltar para a lista de produtos"
        >
          <ArrowLeft size={17} />
        </Link>
        <div>
          <Logo size="sm" to={null} />
          <h1 className="mt-1.5 font-display text-xl font-semibold text-ink md:text-2xl">
            {isEditing ? 'Editar produto' : 'Novo produto'}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid gap-5 md:grid-cols-[1fr_220px]">
          <div className="flex flex-col gap-4">
            <label>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                Nome do prato
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <label>
              <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                Descrição
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label>
                <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  Preço (R$)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
                  Categoria
                </span>
                <input
                  list="admin-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <datalist id="admin-categories">
                  {categories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
            </div>
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Foto (URL)
            </span>
            <div className="h-32 w-full overflow-hidden rounded-xl border border-border">
              <DishImage src={image} alt={name || 'Pré-visualização'} className="h-full w-full" />
            </div>
            <input
              value={image}
              onChange={(e) => setImage(e.target.value)}
              placeholder="https://…"
              className="mt-2 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[12.5px] text-ink focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
            Selos
          </span>
          <div className="flex flex-wrap gap-2">
            {ALL_BADGES.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => toggleBadge(b)}
                className={`min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-medium transition ${
                  badges.includes(b)
                    ? 'border-accent bg-accent text-white'
                    : 'border-border text-ink-soft hover:text-ink'
                }`}
              >
                {BADGE_LABEL[b]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Opções de ponto da carne
            </span>
            <input
              value={pontoCarne}
              onChange={(e) => setPontoCarne(e.target.value)}
              placeholder="Mal passado, Ao ponto, Bem passado"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ink-soft">
              Separadas por vírgula. Deixe em branco se não se aplica.
            </span>
          </label>

          <label>
            <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Ingredientes removíveis
            </span>
            <input
              value={removiveis}
              onChange={(e) => setRemoviveis(e.target.value)}
              placeholder="Cebola, Molho extra"
              className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink focus:border-accent focus:outline-none"
            />
            <span className="mt-1 block text-[11px] text-ink-soft">Separados por vírgula.</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-border pt-5">
          <Link
            to="/admin"
            className="flex min-h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            className="flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:bg-accent/90"
          >
            <Save size={16} />
            {isEditing ? 'Salvar alterações' : 'Criar produto'}
          </button>
        </div>
      </form>
    </div>
  )
}
