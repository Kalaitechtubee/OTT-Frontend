import React, { useEffect } from 'react'
import { X, Calendar, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
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
  onClose: () => void
  onSelectLanguage: (lang: string) => void
  onSelectQuality: (quality: string) => void
  onDownload: () => void
  onRetry: () => void
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
  onClose,
  onSelectLanguage,
  onSelectQuality,
  onDownload,
  onRetry,
}) => {
  // Listen for Escape key to close modal
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    // Prevent body scrolling while modal is open
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)
    
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Get streams for currently selected language
  const filteredStreams = parsedStreams.filter(
    (s) => s.language === selectedLanguage
  )

  const activeStream = filteredStreams.find((s) => s.quality === selectedQuality)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop Overlay */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity duration-300" 
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-xl rounded-3xl border border-white/8 bg-mz-background p-6 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.95)] z-10 transition-all duration-300 scale-100 flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-white/5 pb-4">
          <h3 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">
            Download Options
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-mz-secondary hover:bg-white/5 hover:text-white transition duration-200 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Loading Shimmer Skeletons */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            <div className="flex gap-4">
              <Shimmer className="h-28 w-20 rounded-xl shrink-0" />
              <div className="space-y-3.5 flex-1 py-2">
                <Shimmer className="h-6 w-3/4 rounded" />
                <Shimmer className="h-4 w-1/4 rounded" />
              </div>
            </div>
            <div className="space-y-3">
              <Shimmer className="h-4 w-1/4 rounded" />
              <Shimmer className="h-12 w-full rounded-2xl" />
            </div>
            <div className="space-y-3">
              <Shimmer className="h-4 w-1/4 rounded" />
              <Shimmer className="h-20 w-full rounded-2xl" />
              <Shimmer className="h-20 w-full rounded-2xl" />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-5 py-10 text-center animate-in fade-in duration-300">
            <div className="rounded-full bg-red-500/10 p-3 text-red-500 border border-red-500/20">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="max-w-sm text-sm text-mz-secondary leading-relaxed font-semibold">
              {error}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-xl bg-mz-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-mz-primary-hover shadow-lg hover:shadow-mz-primary/25 cursor-pointer active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Download
            </button>
          </div>
        )}

        {/* Modal Content */}
        {!loading && !error && metadata && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Movie Info Grid */}
            <div className="flex gap-4.5 items-start">
              {metadata.poster ? (
                <img
                  src={metadata.poster}
                  alt={metadata.title}
                  className="w-20 h-28 object-cover rounded-xl border border-white/5 shadow-md shrink-0"
                />
              ) : (
                <div className="w-20 h-28 bg-mz-card flex items-center justify-center text-3xs font-bold text-mz-secondary border border-white/5 rounded-xl shrink-0">
                  No Poster
                </div>
              )}
              <div className="space-y-2">
                <h4 className="font-display text-lg font-extrabold text-white leading-snug">
                  {metadata.title}
                </h4>
                
                <div className="flex flex-wrap items-center gap-3.5 text-xs text-mz-secondary font-semibold">
                  {metadata.year && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {metadata.year}
                    </span>
                  )}
                  {metadata.runtime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {typeof metadata.runtime === 'number' ? `${metadata.runtime} min` : metadata.runtime}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Language Selector */}
            <LanguageSelector
              languages={languages}
              selectedLanguage={selectedLanguage}
              onChange={onSelectLanguage}
            />

            {/* Quality Cards List */}
            <div className="space-y-3">
              <span className="block text-xs font-extrabold uppercase tracking-widest text-mz-secondary">
                Quality Option
              </span>
              
              {filteredStreams.length === 0 ? (
                <p className="text-sm text-mz-secondary italic leading-relaxed">
                  No resolutions found for this audio track.
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[30vh] overflow-y-auto pr-1">
                  {filteredStreams.map((s) => (
                    <QualityCard
                      key={s.originalQuality}
                      stream={s}
                      isSelected={selectedQuality === s.quality}
                      onClick={() => onSelectQuality(s.quality)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 rounded-xl border border-white/10 bg-transparent px-5 py-3.5 text-sm font-bold text-white hover:bg-white/5 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!activeStream}
                onClick={onDownload}
                className={`
                  w-full sm:w-1/2 rounded-xl px-5 py-3.5 text-sm font-bold text-white tracking-wide
                  transition duration-200 select-none cursor-pointer flex items-center justify-center gap-2
                  ${activeStream
                    ? 'bg-mz-primary hover:bg-mz-primary-hover shadow-lg hover:shadow-mz-primary/25'
                    : 'bg-white/5 text-white/40 border border-white/5 cursor-not-allowed'
                  }
                `}
              >
                Start Download
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default DownloadModal
export type { ParsedStream }
