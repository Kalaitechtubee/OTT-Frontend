import type { CSSProperties } from 'react'

interface ShimmerProps {
  className?: string
  style?: CSSProperties
}

export function Shimmer({ className = '', style }: ShimmerProps) {
  return <div className={`shimmer rounded-lg ${className}`} style={style} aria-hidden />
}
