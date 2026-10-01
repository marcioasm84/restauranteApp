import { Link } from 'react-router-dom'
import { ChefHat, ClipboardList, Settings, UtensilsCrossed } from 'lucide-react'
import { INITIAL_TABLES } from '../data/tables'
import DishImage from '../components/DishImage'
import Logo from '../components/Logo'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=1600&q=80&auto=format&fit=crop'

export default function RoleSelect() {
  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-64 w-full flex-none overflow-hidden sm:h-80 lg:h-96">
        <DishImage src={HERO_IMAGE} alt="Mesa Viva" className="h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
        <div
          className="absolute inset-0 flex flex-col items-center justify-end px-6 pb-8 text-center sm:pb-10"
          style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
        >
          <Logo size="lg" to={null} onDark />
          <p className="mx-auto mt-3 max-w-lg text-[13.5px] text-white/90 sm:text-base">
            Peça direto da mesa: cardápio com fotos, acompanhamento do pedido e cozinha em tempo
            real.
          </p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-6 sm:py-10 lg:py-12">
        <div className="mb-6 text-center sm:mb-8">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-copper">
            Demonstração
          </span>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink sm:text-3xl">
            Escolha como entrar
          </h1>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          <div className="flex flex-col rounded-2xl border border-border bg-surface p-5 lg:p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent lg:h-12 lg:w-12">
              <UtensilsCrossed size={20} />
            </div>
            <h2 className="mt-3 font-display text-lg font-medium lg:text-xl">Cliente</h2>
            <p className="mt-1 text-[13px] text-ink-soft">Escolha a mesa para pedir.</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {INITIAL_TABLES.map((t) => (
                <Link
                  key={t.id}
                  to={`/mesa/${t.id}`}
                  className="flex aspect-square min-h-11 items-center justify-center rounded-lg border border-border font-mono text-sm font-semibold text-ink-soft transition hover:border-accent hover:text-accent"
                >
                  {t.number}
                </Link>
              ))}
            </div>
          </div>

          <Link
            to="/garcom"
            className="flex flex-col rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg lg:p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-copper-soft text-copper lg:h-12 lg:w-12">
              <ClipboardList size={20} />
            </div>
            <h2 className="mt-3 font-display text-lg font-medium lg:text-xl">Garçom</h2>
            <p className="mt-1 flex-1 text-[13px] text-ink-soft">
              Mapa de mesas, lançamento de pedidos e fechamento de conta.
            </p>
            <span className="mt-4 text-[13px] font-semibold text-accent">Entrar →</span>
          </Link>

          <Link
            to="/cozinha"
            className="flex flex-col rounded-2xl border border-border bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-lg lg:p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent lg:h-12 lg:w-12">
              <ChefHat size={20} />
            </div>
            <h2 className="mt-3 font-display text-lg font-medium lg:text-xl">Cozinha</h2>
            <p className="mt-1 flex-1 text-[13px] text-ink-soft">
              Painel de pedidos (KDS) para preparo em tempo real.
            </p>
            <span className="mt-4 text-[13px] font-semibold text-accent">Entrar →</span>
          </Link>
        </div>

        <div className="mt-8 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
          >
            <Settings size={13} /> Administração do cardápio
          </Link>
        </div>
      </div>
    </div>
  )
}
