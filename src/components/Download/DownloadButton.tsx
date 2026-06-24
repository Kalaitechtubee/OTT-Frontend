import React from 'react'
import { Download } from 'lucide-react'

interface DownloadButtonProps {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  label?: string
  className?: string
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  onClick,
  disabled = false,
  loading = false,
  label = 'Download',
  className = ''
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2.5 
        rounded-xl px-7 py-4 text-base font-bold tracking-wide
        transition-all duration-300 select-none cursor-pointer
        ${disabled || loading
          ? 'bg-white/5 border border-white/5 text-white/40 cursor-not-allowed opacity-60'
          : 'bg-mz-primary border border-mz-primary text-white hover:bg-mz-primary-hover shadow-lg hover:shadow-mz-primary/20 hover:scale-[1.02] active:scale-[0.98]'
        }
        ${className}
      `}
    >
      <Download className={`h-5 w-5 ${loading ? 'animate-bounce' : ''}`} />
      {loading ? 'Preparing...' : label}
    </button>
  )
}

export default DownloadButton
