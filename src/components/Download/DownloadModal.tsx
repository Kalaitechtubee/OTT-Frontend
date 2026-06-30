import React, { useEffect } from 'react'
import {
  X, Calendar, Clock, AlertTriangle, RefreshCw,
  Download, Server, Layers,
} from 'lucide-react'
import { Shimmer } from '@/components/common/Shimmer'
import { LanguageSelector } from './LanguageSelector'
import { QualityCard } from './QualityCard'
import type { DownloadMetadata, ParsedStream } from '@/hooks/useDownload'

interface DownloadModalProps {
  isOpen: boolean
  loading: boolean
  error: string | null
  languages: string[]
  parsedStreams: ParsedStream[]
  selectedLanguage: string
  selectedQuality: string
  metadata: DownloadMetadata | null
  downloadProvider?: string | null
  downloadType?: string | null
  availableProviders?: { provider: string; id: string; label?: string }[]
  activeProvider?: string | null
  onSelectProvider?: (provider: string) => void
  onClose: () => void
  onSelectLanguage: (lang: string) => void
  onSelectQuality: (quality: string) => void
  onDownload: () => void
  onRetry: () => void
}

const PROVIDER_LABELS: Record<string, string> = {
  'vidsrc-sbs': 'VidSrc SBS',
  peachify: 'Peachify',
  streamimdb: 'StreamIMDb',
  autoembed: 'AutoEmbed',
  embedsu: 'EmbedSU',
  vidsrc: 'VidSrc',
  movieswood: 'MoviesWood',
  moviesda: 'Moviesda',
}

export const DownloadModal: React.FC<DownloadModalProps> = ({
  isOpen,
  loading,
  error,
  languages,
  parsedStreams,
  selectedLanguage,
  selectedQuality,
  metadata,
  downloadProvider,
  downloadType,
  availableProviders,
  activeProvider,
  onSelectProvider,
  onClose,
  onSelectLanguage,
  onSelectQuality,
  onDownload,
  onRetry,
}) => {
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKey)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredStreams = parsedStreams.filter((s) => s.language === selectedLanguage)
  const activeStream = filteredStreams.find((s) => s.originalQuality === selectedQuality)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center overflow-y-auto">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Sheet / Modal */}
      <div
        className={`
          relative w-full sm:max-w-lg z-10 flex flex-col
          bg-[#0f0f13] border border-white/8
          sm:rounded-3xl rounded-t-3xl
          shadow-[0_-8px_60px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.04)]
          max-h-[92dvh] sm:max-h-[88dvh] overflow-y-auto
          transition-all duration-300
        `}
      >
        {/* Top drag handle (mobile) */}
        <div className="flex sm:hidden justify-center pt-3 pb-1 flex-shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/15" />
        </div>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b border-white/6 bg-[#0f0f13]/95 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-mz-primary/15 border border-mz-primary/25">
              <Download className="h-4 w-4 text-mz-primary" />
            </div>
            <div>
              <h3 className="text-[15px] font-black text-white tracking-tight leading-none">
                Download Options
              </h3>
              <p className="text-[10px] text-white/35 font-semibold mt-0.5">
                Choose quality & server
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/[0.04] border border-white/8 text-white/50 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 px-5 py-5 overflow-y-auto">

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-5 animate-pulse">
              <div className="flex gap-4">
                <Shimmer className="h-24 w-16 rounded-2xl shrink-0" />
                <div className="space-y-3 flex-1 py-1">
                  <Shimmer className="h-5 w-2/3 rounded-lg" />
                  <Shimmer className="h-3.5 w-1/3 rounded" />
                  <Shimmer className="h-3.5 w-1/4 rounded" />
                </div>
              </div>
              <Shimmer className="h-px w-full rounded" />
              <div className="space-y-2.5">
                <Shimmer className="h-3 w-1/4 rounded" />
                <div className="flex gap-2">
                  <Shimmer className="h-10 w-24 rounded-xl" />
                  <Shimmer className="h-10 w-24 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2.5">
                <Shimmer className="h-3 w-1/4 rounded" />
                <div className="flex gap-2">
                  <Shimmer className="h-10 w-20 rounded-xl" />
                  <Shimmer className="h-10 w-20 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Shimmer className="h-3 w-1/4 rounded" />
                <Shimmer className="h-16 w-full rounded-2xl" />
                <Shimmer className="h-16 w-full rounded-2xl" />
              </div>
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="flex flex-col items-center gap-5 py-10 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-white">Something went wrong</p>
                <p className="text-xs text-white/50 leading-relaxed max-w-xs font-medium">{error}</p>
              </div>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-mz-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-mz-primary/90 shadow-lg shadow-mz-primary/20 cursor-pointer active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
            </div>
          )}

          {/* Main content */}
          {!loading && !error && metadata && (
            <>
              {/* ── Movie Info Card ──────────────────────────────────────── */}
              <div className="flex gap-4 items-start p-4 rounded-2xl bg-white/[0.03] border border-white/6">
                {metadata.poster ? (
                  <img
                    src={metadata.poster}
                    alt={metadata.title}
                    className="w-[52px] h-[72px] object-cover rounded-xl border border-white/8 shadow-md flex-shrink-0"
                  />
                ) : (
                  <div className="w-[52px] h-[72px] rounded-xl bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                    <span className="text-[9px] text-white/30 font-bold text-center px-1 leading-tight">No Poster</span>
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <h4 className="font-black text-white text-[15px] leading-tight line-clamp-2 tracking-tight">
                    {metadata.title}
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/45 font-bold">
                    {metadata.year && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {metadata.year}
                      </span>
                    )}
                    {metadata.runtime && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {typeof metadata.runtime === 'number' ? `${metadata.runtime} min` : metadata.runtime}
                      </span>
                    )}
                  </div>

                  {/* Provider + Type micro badges */}
                  {(downloadProvider || downloadType) && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {downloadProvider && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-mz-primary/10 border border-mz-primary/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-mz-primary">
                          <Server className="h-2.5 w-2.5" />
                          {downloadProvider}
                        </span>
                      )}
                      {downloadType && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 border border-white/8 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/50">
                          <Layers className="h-2.5 w-2.5" />
                          {downloadType}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Divider ─────────────────────────────────────────────── */}
              <div className="h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

              {/* ── Server Selector ──────────────────────────────────────── */}
              {availableProviders && availableProviders.length > 1 && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
                      Download Server
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {availableProviders.map((prov) => {
                      const isSelected = activeProvider === prov.provider
                      const label = PROVIDER_LABELS[prov.provider] || prov.provider
                      return (
                        <button
                          key={prov.provider}
                          type="button"
                          onClick={() => onSelectProvider?.(prov.provider)}
                          className={`
                            rounded-xl px-4 py-2 text-[12px] font-bold transition-all duration-200 cursor-pointer border
                            ${isSelected
                              ? 'bg-mz-primary border-mz-primary text-white shadow-[0_0_15px_rgba(229,9,20,0.25)]'
                              : 'bg-white/[0.04] border-white/8 text-white/55 hover:bg-white/[0.08] hover:border-white/15 hover:text-white'
                            }
                          `}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── Language Selector ────────────────────────────────────── */}
              <LanguageSelector
                languages={languages}
                selectedLanguage={selectedLanguage}
                onChange={onSelectLanguage}
              />

              {/* ── Quality Cards ────────────────────────────────────────── */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
                    Quality
                  </span>
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] text-white/25 font-bold">
                    {filteredStreams.length} option{filteredStreams.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {filteredStreams.length === 0 ? (
                  <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-5 text-center">
                    <p className="text-sm text-white/35 font-medium">
                      No qualities available for this language.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[32vh] overflow-y-auto pr-0.5 -mr-0.5">
                    {filteredStreams.map((s) => (
                      <QualityCard
                        key={`${s.originalQuality}-${s.size}-${s.url}`}
                        stream={s}
                        isSelected={selectedQuality === s.originalQuality}
                        onClick={() => onSelectQuality(s.originalQuality)}
                      />
                    ))}
                  </div>
                )}
              </div>


            </>
          )}
        </div>

        {/* ── Footer Action Bar ───────────────────────────────────────────── */}
        {!loading && !error && metadata && (
          <div className="sticky bottom-0 z-10 flex gap-3 px-5 py-4 bg-[#0f0f13]/95 backdrop-blur-sm border-t border-white/6 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-transparent px-5 py-3 text-sm font-bold text-white/70 hover:bg-white/[0.04] hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!activeStream}
              onClick={onDownload}
              className={`
                flex-[2] rounded-xl px-5 py-3 text-sm font-black text-white tracking-wide
                transition-all duration-200 select-none cursor-pointer flex items-center justify-center gap-2
                ${activeStream
                  ? 'bg-mz-primary hover:bg-mz-primary/90 shadow-lg shadow-mz-primary/25 active:scale-[0.98]'
                  : 'bg-white/5 text-white/25 border border-white/8 cursor-not-allowed'
                }
              `}
            >
              <Download className={`h-4 w-4 ${!activeStream && 'opacity-40'}`} />
              {activeStream ? `Download ${activeStream.quality}` : 'Select Quality'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DownloadModal
export type { ParsedStream }
