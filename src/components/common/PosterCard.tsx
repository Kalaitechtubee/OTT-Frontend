import { useEffect, useRef, memo } from 'react'
import { Link } from 'react-router-dom'
import { Play, Star } from 'lucide-react'
import { paths } from '@/routes/paths'
import { parseV2Rating } from '@/types/v2'
import { LazyImage } from '@/components/common/LazyImage'
import { getDetailsV2, getDetailsByTmdbId } from '@/services/api'
import type { V2SearchResult } from '@/types/v2'

interface PosterCardProps {
  result: V2SearchResult
  rank?: number
  className?: string
  variant?: 'grid' | 'rail' | 'trending' | 'large'
}

export const PosterCard = memo(function PosterCard({
  result,
  rank,
  className = '',
  variant = 'grid',
}: PosterCardProps) {
  const isTrending = variant === 'trending'
  const isLarge = variant === 'large'
  const isGrid = variant === 'grid'
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // V2 already returns full URLs
  const img = isTrending
    ? (result.backdrop || result.poster || '')
    : (result.poster || result.backdrop || '')

  const containerWidth = isGrid
    ? 'w-full'
    : isTrending
    ? 'w-[240px] sm:w-[280px] shrink-0'
    : isLarge
    ? 'w-[180px] sm:w-[215px] shrink-0'
    : 'w-[150px] sm:w-[170px] shrink-0'

  const rating = parseV2Rating(result.rating)

  const detailLink = (result.provider === 'tmdb' || !result.provider || !result.id) && result.tmdbId
    ? paths.tmdbDetail(String(result.tmdbId), {
        title: result.title,
        year: result.year,
        type: result.mediaType,
      })
    : paths.detail(result.provider, result.id, {
        title: result.title,
        year: result.year,
        sources: result.sources,
      })

  const prefetchDetails = () => {
    // Hover intent check (80ms)
    prefetchTimerRef.current = setTimeout(() => {
      const isTmdb = result.provider === 'tmdb' || !result.provider || !result.id
      if (isTmdb && result.tmdbId) {
        const type = result.mediaType || 'movie'
        void getDetailsByTmdbId(String(result.tmdbId), type, result.title, result.year)
      } else if (result.provider && result.id) {
        void getDetailsV2(
          result.provider,
          result.id,
          result.title,
          result.year,
          result.sources ? result.sources.map((s) => `${s.provider}:${s.id}`).join(',') : undefined
        )
      }
    }, 80)
  }

  const cancelPrefetch = () => {
    if (prefetchTimerRef.current) {
      clearTimeout(prefetchTimerRef.current)
      prefetchTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      if (prefetchTimerRef.current) {
        clearTimeout(prefetchTimerRef.current)
      }
    }
  }, [])

  return (
    <Link
      to={detailLink}
      onMouseEnter={prefetchDetails}
      onMouseLeave={cancelPrefetch}
      className={`group relative block ${containerWidth} ${className}`}
    >
      <div className="flex flex-col">
        <div className="relative">
          {rank != null && (
            <span className="pointer-events-none absolute -left-5 sm:-left-7 bottom-2 z-0 text-7xl sm:text-8xl font-black leading-none select-none text-stroke-rank drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)]">
              {rank}
            </span>
          )}
          <div
            className={`relative z-10 overflow-hidden rounded-xl bg-mz-card border border-white/8 transition-all duration-300 md:group-hover:scale-[1.04] md:group-hover:border-mz-primary/60 md:group-hover:shadow-[0_12px_28px_rgba(225,29,72,0.35)] ${
              isTrending ? 'aspect-video w-full' : 'aspect-[2/3] w-full'
            }`}
          >
            {img ? (
              <LazyImage
                src={img}
                alt={result.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-2 text-center text-xs text-mz-secondary">
                {result.title}
              </div>
            )}

            {/* Interactive play overlay */}
            <div className="absolute inset-0 bg-black/45 opacity-0 md:group-hover:opacity-100 flex items-center justify-center transition-all duration-300 z-20">
              <div className="flex h-11 w-11 scale-75 md:group-hover:scale-100 items-center justify-center rounded-full bg-mz-primary/95 text-white shadow-lg transition-transform duration-300 shadow-mz-primary/30">
                <Play className="h-5 w-5 fill-white ml-0.5" />
              </div>
            </div>

            {/* A. Trending card layout (landscape with metadata overlaid on bottom gradient) */}
            {isTrending && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-15 pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 p-3 z-20 flex flex-col justify-end translate-y-0 md:translate-y-1 md:group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                  <p className="line-clamp-1 text-sm sm:text-base font-extrabold text-white leading-tight">
                    {result.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-white/70 font-semibold uppercase tracking-wider">
                    <span className="rounded bg-mz-primary/90 px-1.5 py-0.2 text-[8px] font-bold text-white leading-none">
                      {result.mediaType}
                    </span>
                    {result.year && <span>{result.year}</span>}
                    {rating > 0 && (
                      <span className="flex items-center gap-0.5 text-yellow-400 font-bold">
                        <Star className="h-3 w-3 fill-yellow-400" />
                        {rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* B. Large card layout (portrait with glassmorphic bottom overlay slide-up footer) */}
            {isLarge && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 max-md:bg-zinc-950/90 backdrop-blur-md max-md:backdrop-blur-none border-t border-white/5 p-2.5 z-20 translate-y-0 md:translate-y-1.5 md:group-hover:translate-y-0 transition-transform duration-300 pointer-events-none">
                <p className="line-clamp-1 text-xs sm:text-sm font-extrabold text-white leading-tight">
                  {result.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-[9px] text-mz-secondary font-bold uppercase tracking-wider">
                  <span className="rounded bg-white/10 px-1.5 py-0.2 text-[8px] font-extrabold text-white/90 leading-none">
                    {result.mediaType}
                  </span>
                  {result.year && <span>{result.year}</span>}
                  {rating > 0 && (
                    <span className="flex items-center gap-0.5 text-yellow-400 font-bold">
                      <Star className="h-2.5 w-2.5 fill-yellow-400" />
                      {rating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* C. Standard card details (rating badge inside container for rails) */}
            {rating > 0 && !isLarge && !isTrending && (
              <span className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-yellow-400">
                <Star className="h-2.5 w-2.5 fill-yellow-400" />
                {rating.toFixed(1)}
              </span>
            )}

            {/* Provider badge (non-TMDB providers) */}
            {result.provider && result.provider !== 'tmdb' && (
              <span className="absolute bottom-2 left-2 z-10 rounded bg-mz-primary/90 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                {result.provider}
              </span>
            )}
          </div>
        </div>

        {/* D. Standard rail items layout (details below the image container) */}
        {!isTrending && !isLarge && (
          <div className="mt-2.5 px-0.5 min-w-0">
            <p className="line-clamp-1 text-[15px] sm:text-base font-extrabold text-white/95 md:group-hover:text-mz-primary transition-colors">
              {result.title}
            </p>
            <p className="mt-0.5 text-xs sm:text-sm text-mz-secondary capitalize">
              {result.mediaType} {result.year ? `· ${result.year}` : ''}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
})
