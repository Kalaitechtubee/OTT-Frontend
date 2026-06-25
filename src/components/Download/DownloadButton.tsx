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
        btn-primary inline-flex items-center justify-center gap-2.5 
        rounded-full px-8 py-4 text-base font-bold tracking-wide
        transition-all duration-300 select-none cursor-pointer
        ${className}
      `}
    >
      <Download className={`h-5 w-5 ${loading ? 'animate-bounce' : ''}`} />
      {loading ? 'Preparing...' : label}
    </button>
  )
}

export default DownloadButton
