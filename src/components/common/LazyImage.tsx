import { useEffect, useRef, useState } from 'react'

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string
  alt: string
}

export function LazyImage({
  src,
  alt,
  className = '',
  loading: _loading, // ignore custom loading attribute as we control it
  ...props
}: LazyImageProps) {
  const [isIntersected, setIsIntersected] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isFailed, setIsFailed] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If browser doesn't support IntersectionObserver, load immediately
    if (typeof window === 'undefined' || !window.IntersectionObserver) {
      setIsIntersected(true)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersected(true)
          observer.unobserve(el)
        }
      },
      {
        rootMargin: '250px 0px', // Start loading when card is 250px away horizontally/vertically
      }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Use a fallback text if image failed to load
  if (isFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-mz-card p-2 text-center text-xs text-mz-secondary">
        {alt}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-mz-card`}
    >
      {/* Display shimmer placeholder if not fully loaded */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-mz-card shimmer animate-shimmer" />
      )}

      {/* Render actual image once intersected */}
      {isIntersected && (
        <img
          src={src}
          alt={alt}
          onLoad={() => {
            // Asynchronously decode image for smoother rendering
            const el = containerRef.current?.querySelector('img')
            if (el && typeof el.decode === 'function') {
              el.decode()
                .then(() => setIsLoaded(true))
                .catch(() => setIsLoaded(true)) // Fallback to immediate load
            } else {
              setIsLoaded(true)
            }
          }}
          onError={() => setIsFailed(true)}
          className={`h-full w-full object-cover transition-all duration-500 ease-out ${
            isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  )
}
