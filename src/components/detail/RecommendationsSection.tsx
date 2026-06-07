import { Link } from 'react-router-dom'
import type { V2Recommendation } from '@/types/v2'

interface RecommendationsSectionProps {
  recommendations: V2Recommendation[]
}

export function RecommendationsSection({
  recommendations,
}: RecommendationsSectionProps) {
  if (!recommendations || !recommendations.length) return null

  return (
    <section className="relative mt-12 border-t border-white/10 pt-10">
      <h2 className="font-display text-xl font-bold lg:text-2xl">
        More Like This
      </h2>
      <div className="no-scrollbar mt-5 flex gap-4 overflow-x-auto pb-2 scroll-smooth">
        {recommendations.map((rec) => {
          const poster = rec.posterPath
          return (
            <Link
              key={rec.id}
              to={`/search?q=${encodeURIComponent(rec.title)}`}
              className="group relative block w-[150px] sm:w-[170px] shrink-0"
            >
              <div className="flex flex-col">
                <div className="relative overflow-hidden rounded-xl bg-mz-card border border-white/8 transition-all duration-300 group-hover:scale-[1.03] group-hover:border-white/50 group-hover:ring-2 group-hover:ring-white group-hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] aspect-[2/3] w-full">
                  {poster ? (
                    <img
                      src={poster}
                      alt={rec.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-2 text-center text-xs text-mz-secondary">
                      {rec.title}
                    </div>
                  )}
                </div>
                <div className="mt-2.5 px-0.5 min-w-0">
                  <p className="line-clamp-1 text-[15px] sm:text-base font-extrabold text-white/95 group-hover:text-white transition-colors">
                    {rec.title}
                  </p>
                  <p className="mt-0.5 text-xs sm:text-sm text-mz-secondary capitalize">
                    {rec.mediaType}
                  </p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
