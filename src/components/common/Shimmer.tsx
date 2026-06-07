interface ShimmerProps {
  className?: string
}

export function Shimmer({ className = '' }: ShimmerProps) {
  return <div className={`shimmer rounded-lg ${className}`} aria-hidden />
}
