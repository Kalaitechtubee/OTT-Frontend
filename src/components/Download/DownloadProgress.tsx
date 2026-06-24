import React, { useEffect, useState } from 'react'
import { X, CheckCircle, DownloadCloud } from 'lucide-react'

interface DownloadProgressProps {
  message: string | null
  onDismiss: () => void
}

export const DownloadProgress: React.FC<DownloadProgressProps> = ({
  message,
  onDismiss
}) => {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onDismiss, 300) // Allow exit animation to finish
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [message, onDismiss])

  if (!message && !visible) return null

  return (
    <div
      className={`
        fixed bottom-6 right-6 z-50 max-w-sm w-full
        transition-all duration-500 ease-out transform
        ${visible 
          ? 'translate-y-0 opacity-100 scale-100' 
          : 'translate-y-4 opacity-0 scale-95 pointer-events-none'
        }
      `}
    >
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-mz-card/90 p-5 shadow-[0_15px_40px_rgba(0,0,0,0.8)] backdrop-blur-xl">
        {/* Progress Bar (Visual Timer) */}
        <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 animate-shrink-width" style={{ animationDuration: '5000ms' }} />

        <div className="flex items-start gap-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle className="h-5 w-5" />
          </div>

          <div className="flex-1 space-y-1">
            <h4 className="text-sm font-bold text-white tracking-wide">
              {message}
            </h4>
            <div className="flex items-start gap-1.5 text-2xs text-mz-secondary font-medium leading-relaxed">
              <DownloadCloud className="h-3.5 w-3.5 text-mz-primary shrink-0 mt-0.5" />
              <span>Natively managed by your browser. Supports pause & resume.</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setVisible(false)
              setTimeout(onDismiss, 300)
            }}
            className="rounded-lg p-1 text-mz-secondary hover:bg-white/5 hover:text-white transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default DownloadProgress
