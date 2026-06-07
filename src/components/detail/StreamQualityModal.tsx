import { Play, X, Smartphone, DownloadCloud } from 'lucide-react'
import type { V2Stream } from '@/types/v2'

export type StreamQualityMode = 'play' | 'download_offline' | 'download_device'

interface StreamQualityModalProps {
  open: boolean
  mode: StreamQualityMode
  title: string
  streams: V2Stream[]
  loading?: boolean
  onClose: () => void
  onSelect: (stream: V2Stream) => void
}

export function StreamQualityModal({
  open,
  mode,
  title,
  streams,
  loading,
  onClose,
  onSelect,
}: StreamQualityModalProps) {
  if (!open) return null

  const isPlay = mode === 'play'
  const isOffline = mode === 'download_offline'

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quality-modal-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-mz-card shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <h2 id="quality-modal-title" className="font-display text-lg font-semibold">
              {isPlay
                ? 'Select playback quality'
                : isOffline
                ? 'Select quality for offline download'
                : 'Select quality for device download'}
            </h2>
            <p className="mt-1 text-sm text-mz-secondary line-clamp-2">{title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-mz-secondary hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-mz-secondary">
              Loading available qualities…
            </p>
          ) : streams.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-mz-secondary">
              No streams available for this title.
            </p>
          ) : (
            <ul className="space-y-1">
              {streams.map((stream, index) => {
                return (
                  <li key={`${stream.quality}-${index}`}>
                    <button
                      type="button"
                      onClick={() => onSelect(stream)}
                      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition hover:bg-white/5"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mz-primary/15 text-mz-primary">
                        {isPlay ? (
                          <Play className="h-5 w-5 fill-current" />
                        ) : isOffline ? (
                          <Smartphone className="h-5 w-5" />
                        ) : (
                          <DownloadCloud className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold text-white">
                          {stream.label || `${stream.quality} Quality`}
                        </span>
                        <span className="text-xs text-mz-secondary">
                          {stream.label ? 'Alternative Source Link' : 'Provider stream link'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
