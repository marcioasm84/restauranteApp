import { useState } from 'react'
import { Star, ThumbsUp } from 'lucide-react'
import { useBillingStore } from '../store/useBillingStore'

export default function ReviewModal({
  billId,
  onDone,
}: {
  billId: string
  onDone: () => void
}) {
  const submitReview = useBillingStore((s) => s.submitReview)
  const reviewSubmitted = useBillingStore((s) => s.reviewSubmitted)
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')

  const handleSubmit = () => {
    submitReview({ billId, rating, comment })
  }

  if (reviewSubmitted) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 animate-fade-in">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-3xl bg-surface p-8 text-center animate-slide-up">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
            <ThumbsUp size={26} />
          </span>
          <h2 className="font-display text-lg font-medium text-ink">Obrigado!</h2>
          <p className="text-sm text-ink-soft">Sua avaliação ajuda a gente a melhorar.</p>
          <button
            onClick={onDone}
            className="mt-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-white"
          >
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center sm:p-4 animate-fade-in">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-surface p-6 sm:rounded-3xl animate-slide-up">
        <h2 className="font-display text-lg font-medium text-ink">Como foi sua experiência?</h2>
        <p className="mt-1 text-[13px] text-ink-soft">Conta pra gente o que achou da refeição.</p>

        <div className="mt-5 flex justify-center gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${n} estrelas`}
              className="p-1 text-copper transition"
            >
              <Star
                size={34}
                fill={n <= (hovered || rating) ? 'currentColor' : 'none'}
                strokeWidth={1.5}
              />
            </button>
          ))}
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Algo que quer contar? (opcional)"
          rows={3}
          className="mt-5 w-full resize-none rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-soft/70 focus:border-accent focus:outline-none"
        />

        <div className="mt-5 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink-soft hover:text-ink"
          >
            Agora não
          </button>
          <button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="flex-1 rounded-full bg-accent py-3 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Enviar avaliação
          </button>
        </div>
      </div>
    </div>
  )
}
