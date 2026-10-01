import { useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'

export default function DishImage({
  src,
  alt,
  className = '',
}: {
  src: string
  alt: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed || !src.trim()) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-copper-soft to-accent-soft text-ink-soft ${className}`}
      >
        <UtensilsCrossed size={28} strokeWidth={1.5} />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  )
}
