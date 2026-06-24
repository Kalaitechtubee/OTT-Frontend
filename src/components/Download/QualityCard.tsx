import React from 'react'
import { CheckCircle2, AlertTriangle, Cpu, HardDrive } from 'lucide-react'
import type { ParsedStream } from '@/hooks/useDownload'

interface QualityCardProps {
  stream: ParsedStream
  isSelected: boolean
  onClick: () => void
}

export const QualityCard: React.FC<QualityCardProps> = ({
  stream,
  isSelected,
  onClick,
}) => {
  // Parse numeric size from "1.8 GB" or "980 MB" to check if > 2GB
  const isLarge = (() => {
    const sizeStr = stream.size.toLowerCase()
    if (sizeStr.includes('gb')) {
      const val = parseFloat(sizeStr)
      return val >= 2.0
    }
    return false
  })()

  return (
    <button
      type="button"
      onClick={onClick}
      aria-checked={isSelected}
      role="radio"
      className={`
        w-full text-left flex flex-col sm:flex-row sm:items-center sm:justify-between
        rounded-2xl p-4.5 border transition-all duration-300 outline-none select-none cursor-pointer gap-4
        ${isSelected
          ? 'bg-mz-primary/[0.08] border-mz-primary ring-1 ring-mz-primary/25 shadow-lg shadow-mz-primary/5'
          : 'bg-mz-card border-white/5 hover:bg-white/[0.03] hover:border-white/10 focus-visible:border-white/15'
        }
      `}
    >
      <div className="flex items-start gap-4">
        {/* Active Indicator Radio Icon */}
        <div className="mt-1 shrink-0">
          {isSelected ? (
            <CheckCircle2 className="h-5 w-5 text-mz-primary animate-scale-in" />
          ) : (
            <div className="h-5 w-5 rounded-full border border-white/20 bg-transparent" />
          )}
        </div>

        {/* Quality Info */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-bold text-white tracking-wide">
              {stream.quality}
            </span>
            
            {/* Codec Tag */}
            <span className="inline-flex items-center gap-1 rounded bg-white/5 border border-white/8 px-1.5 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-white/70">
              <Cpu className="h-2.5 w-2.5" />
              {stream.codec}
            </span>
          </div>

          <p className="text-xs text-mz-secondary font-medium leading-relaxed max-w-sm">
            Optimized direct video link. Starts stream immediately on client.
          </p>

          {isLarge && (
            <div className="flex items-center gap-1.5 text-yellow-500/90 text-3xs font-bold uppercase tracking-wider animate-in fade-in duration-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>Warning: File exceeds 2.0 GB. Wi-Fi recommended.</span>
            </div>
          )}
        </div>
      </div>

      {/* File Size and Info */}
      <div className="flex sm:flex-col items-center sm:items-end justify-between border-t border-white/5 pt-3.5 sm:border-0 sm:pt-0 gap-2">
        <span className="text-2xs font-extrabold text-mz-secondary uppercase tracking-widest sm:hidden">
          Estimated Size
        </span>
        <div className="flex items-center gap-1.5 text-base font-extrabold text-white">
          <HardDrive className="h-4.5 w-4.5 text-mz-primary" />
          <span>{stream.size}</span>
        </div>
      </div>
    </button>
  )
}

export default QualityCard
