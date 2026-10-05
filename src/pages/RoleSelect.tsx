import { Link } from 'react-router-dom'
import { BookOpen, ChefHat, ClipboardList, Lock, Settings, UtensilsCrossed } from 'lucide-react'
import { useRestaurantStore } from '../store/useRestaurantStore'
import { getUnlockedTableId } from '../lib/tableSession'
import DishImage from '../components/DishImage'
import Logo from '../components/Logo'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1533777857889-4be7c70b33f7?w=1600&q=80&auto=format&fit=crop'

export default function RoleSelect() {
  const tables = useRestaurantStore((s) => s.tables)
  const unlockedTableId = getUnlockedTableId()
  const unlockedTable = unlockedTableId ? tables.find((t) => t.id === unlockedTableId) : null

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-64 w-full flex-none overflow-hidden sm:h-80 lg:h-96">
        <DishImage src={HERO_IMAGE} alt="Diferente D+" className="h-full w-full" />
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
            {unlockedTable ? (
              <>
                <p className="mt-1 flex-1 text-[13px] text-ink-soft">Sua mesa liberada:</p>
                <Link
                  to={`/mesa/${unlockedTable.id}`}
                  className="mt-4 flex items-center justify-center rounded-xl border border-accent bg-accent-soft py-3 font-mono text-lg font-semibold text-accent transition hover:bg-accent hover:text-white"
                >
                  Mesa {unlockedTable.number}
                </Link>
                <Link
                  to="/liberar-mesa"
                  className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
                >
                  <Lock size={12} /> Trocar mesa
                </Link>
              </>
            ) : (
              <>
                <p className="mt-1 flex-1 text-[13px] text-ink-soft">
                  Veja o cardápio livremente ou peça para o garçom liberar sua mesa.
                </p>
                <Link
                  to="/cardapio"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-full bg-accent py-2.5 text-[13px] font-semibold text-white transition hover:bg-accent/90"
                >
                  <BookOpen size={15} /> Ver cardápio
                </Link>
                <Link
                  to="/liberar-mesa"
                  className="mt-3 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink"
                >
                  <Lock size={12} /> Sou garçom: liberar mesa
                </Link>
              </>
            )}
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
