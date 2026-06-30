import React from 'react'
import { AlertTriangle } from 'lucide-react'
import type { ParsedStream } from '@/hooks/useDownload'

interface QualityCardProps {
  stream: ParsedStream
  isSelected: boolean
  onClick: () => void
}

// Quality badge color map
const QUALITY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  '4K':     { bg: 'bg-violet-500/15', text: 'text-violet-400', ring: 'ring-violet-500/30' },
  '2160p':  { bg: 'bg-violet-500/15', text: 'text-violet-400', ring: 'ring-violet-500/30' },
  '1080p':  { bg: 'bg-blue-500/15',   text: 'text-blue-400',   ring: 'ring-blue-500/30' },
  '720p':   { bg: 'bg-emerald-500/15',text: 'text-emerald-400',ring: 'ring-emerald-500/30' },
  '480p':   { bg: 'bg-amber-500/15',  text: 'text-amber-400',  ring: 'ring-amber-500/30' },
  '360p':   { bg: 'bg-orange-500/15', text: 'text-orange-400', ring: 'ring-orange-500/30' },
}

function getQualityColor(quality: string) {
  for (const [key, val] of Object.entries(QUALITY_COLORS)) {
    if (quality.toLowerCase().includes(key.toLowerCase())) return val
  }
  return { bg: 'bg-white/10', text: 'text-white/70', ring: 'ring-white/20' }
}

export const QualityCard: React.FC<QualityCardProps> = ({ stream, isSelected, onClick }) => {
  const isLarge = (() => {
    const s = stream.size.toLowerCase()
    if (s.includes('gb')) return parseFloat(s) >= 2.0
    return false
  })()

  const qColor = getQualityColor(stream.quality)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isSelected}
      className={`
        group w-full text-left rounded-2xl border transition-all duration-200
        outline-none select-none cursor-pointer relative overflow-hidden
        ${isSelected
          ? 'border-mz-primary bg-gradient-to-br from-mz-primary/10 to-mz-primary/5 shadow-[0_0_25px_rgba(229,9,20,0.12)]'
          : 'border-white/6 bg-white/[0.025] hover:bg-white/[0.045] hover:border-white/12'
        }
      `}
    >
      {/* Selected glow line at top */}
      {isSelected && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-mz-primary/80 to-transparent" />
      )}

      <div className="flex items-center gap-4 p-4">
        {/* Radio Indicator */}
        <div className={`
          flex-shrink-0 h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all duration-200
          ${isSelected ? 'border-mz-primary' : 'border-white/20 group-hover:border-white/40'}
        `}>
          {isSelected && (
            <div className="h-2 w-2 rounded-full bg-mz-primary animate-scale-in" />
          )}
        </div>

        {/* Quality Badge + Label */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Resolution badge */}
            <span className={`
              inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-black
              tracking-wide ring-1 ${qColor.bg} ${qColor.text} ${qColor.ring}
            `}>
              {stream.quality}
            </span>

            {/* Codec tag */}
            <span className="inline-flex items-center rounded-md bg-white/[0.06] border border-white/8 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
              {stream.codec}
            </span>

            {/* Language if present */}
            {stream.language && (
              <span className="inline-flex items-center rounded-md bg-white/[0.04] border border-white/6 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/40">
                {stream.language}
              </span>
            )}
          </div>

          {/* Wi-Fi warning */}
          {isLarge && (
            <div className="flex items-center gap-1.5 text-amber-400/90 text-[10px] font-bold uppercase tracking-wider">
              <AlertTriangle className="h-3 w-3 flex-shrink-0" />
              <span>Large file — Wi-Fi recommended</span>
            </div>
          )}
        </div>

        {/* File Size */}
        <div className="flex-shrink-0 text-right">
          <div className={`text-base font-black tabular-nums ${isSelected ? 'text-white' : 'text-white/70 group-hover:text-white'} transition-colors`}>
            {stream.size}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-white/30 font-bold mt-0.5">
            size
          </div>
        </div>
      </div>
    </button>
  )
}

export default QualityCard
