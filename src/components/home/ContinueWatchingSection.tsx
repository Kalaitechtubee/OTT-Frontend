import { Link } from 'react-router-dom'
import { Play } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { paths } from '@/routes/paths'
import { useHistoryStore } from '@/store/historyStore'
import { posterUrl } from '@/types/movie'

export function ContinueWatchingSection() {
  const items = useHistoryStore((s) => s.items).filter((i) => i.progress > 2)

  if (!items.length) return null

  return (
    <section className="relative py-8">
      <PageContainer>
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-mz-primary shadow-primary" />
          <h2 className="font-display text-2xl font-black tracking-tight lg:text-3xl">
            Continue Watching
          </h2>
        </div>
      </PageContainer>

      <div className="no-scrollbar mask-gradient-x scroll-rail-bleed mt-5 flex gap-4 overflow-x-auto py-4 pt-5 pb-6 scroll-smooth">
        {items.map(({ movie, progress, duration, playContext: ctx }) => {
          const pct = duration > 0 ? (progress / duration) * 100 : 0
          const detailPath = movie.id && movie.id > 0
            ? paths.tmdbDetail(String(movie.id), {
                title: movie.title,
                type: movie.type,
              })
            : ctx
            ? paths.detail(ctx.provider, ctx.id, { title: movie.title })
            : paths.detail(movie.type, movie.overview || String(movie.id))
          return (
            <Link
              key={`${movie.type}-${movie.id}`}
              to={detailPath}
              className="group flex w-[min(85vw,320px)] shrink-0 gap-3.5 rounded-xl border border-white/5 bg-white/[0.02] backdrop-blur-md p-3 transition-all duration-300 hover:border-mz-primary/30 hover:bg-white/[0.06] hover:shadow-[0_8px_24px_rgba(225,29,72,0.15)]"
            >
              <div className="relative aspect-video w-36 shrink-0 overflow-hidden rounded-lg sm:w-40 bg-mz-surface">
                {(movie.backdropPath || movie.posterPath) && (
                  <img
                    src={posterUrl(
                      movie.backdropPath ?? movie.posterPath,
                      'w500',
                    )}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition duration-300 group-hover:opacity-100 z-20">
                  <div className="flex h-9 w-9 scale-75 group-hover:scale-100 items-center justify-center rounded-full bg-mz-primary text-white shadow-lg transition-transform duration-300">
                    <Play className="h-4.5 w-4.5 fill-white ml-0.5" />
                  </div>
                </div>
                {/* Custom modern progress bar overlaid inside image */}
                <div className="absolute bottom-1.5 left-1.5 right-1.5 h-1.5 bg-white/20 rounded-full overflow-hidden z-25">
                  <div
                    className="h-full bg-mz-primary rounded-full"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-center">
                <p className="font-extrabold line-clamp-1 group-hover:text-mz-primary transition-colors text-white/90">
                  {movie.title}
                </p>
                <p className="mt-1 text-xs font-semibold capitalize text-mz-secondary flex items-center gap-1.5">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-mz-primary animate-pulse" />
                  {movie.type} · {Math.round(pct)}% complete
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
