import { X } from 'lucide-react'

interface TrailerModalProps {
  open: boolean
  title: string
  youtubeKey: string
  onClose: () => void
}

export function TrailerModal({
  open,
  title,
  youtubeKey,
  onClose,
}: TrailerModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} trailer`}
    >
      <div className="relative w-full max-w-5xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-12 right-0 rounded-lg p-2 text-white/80 hover:bg-white/10 hover:text-white"
          aria-label="Close trailer"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="overflow-hidden rounded-xl bg-black shadow-2xl ring-1 ring-white/10">
          <div className="aspect-video w-full">
            <iframe
              title={`${title} trailer`}
              src={`https://www.youtube.com/embed/${youtubeKey}?autoplay=1&rel=0&modestbranding=1`}
              className="h-full w-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
        <p className="mt-3 text-center text-sm text-mz-secondary">{title}</p>
      </div>
    </div>
  )
}
