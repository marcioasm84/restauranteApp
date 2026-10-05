import { Link } from 'react-router-dom'

const SIZES = {
  sm: { badge: 'h-8 w-8', word: 'text-[15px]', gap: 'gap-2' },
  md: { badge: 'h-10 w-10', word: 'text-lg', gap: 'gap-2.5' },
  lg: { badge: 'h-14 w-14', word: 'text-2xl', gap: 'gap-3' },
} as const

export default function Logo({
  size = 'sm',
  to = '/',
  onDark = false,
}: {
  size?: keyof typeof SIZES
  to?: string | null
  onDark?: boolean
}) {
  const s = SIZES[size]
  const content = (
    <span className={`inline-flex items-center ${s.gap}`}>
      <span
        className={`flex ${s.badge} flex-none items-center justify-center overflow-hidden rounded-full bg-black shadow-sm`}
      >
        <img
          src="/diferente_dmais_logo.jpeg"
          alt=""
          className="h-full w-full object-cover"
        />
      </span>
      <span
        className={`font-display ${s.word} font-semibold leading-none ${onDark ? 'text-white' : 'text-ink'}`}
      >
        Diferente D+
      </span>
    </span>
  )

  if (!to) return content

  return (
    <Link to={to} className="inline-flex items-center transition hover:opacity-85">
      {content}
    </Link>
  )
}
