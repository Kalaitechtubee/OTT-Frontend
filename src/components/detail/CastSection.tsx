import { User } from 'lucide-react'
import type { V2CastMember } from '@/types/v2'

interface CastSectionProps {
  cast: V2CastMember[]
}

export function CastSection({ cast }: CastSectionProps) {
  if (!cast || !cast.length) return null

  return (
    <section className="mt-12 border-t border-white/10 pt-10">
      <h2 className="font-display text-xl font-bold lg:text-2xl">Cast</h2>
      <div className="no-scrollbar mt-5 flex gap-5 overflow-x-auto pb-2 scroll-smooth">
        {cast.map((member, idx) => {
          const photo = member.profilePath
          return (
            <div
              key={`${member.name}-${idx}`}
              className="w-[120px] shrink-0 sm:w-[132px]"
            >
              <div className="mx-auto flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-mz-card ring-1 ring-white/10 sm:h-[132px] sm:w-[132px]">
                {photo ? (
                  <img
                    src={photo}
                    alt={member.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <User className="h-10 w-10 text-mz-secondary" />
                )}
              </div>
              <p className="mt-3 line-clamp-2 text-center text-sm font-semibold text-white">
                {member.name}
              </p>
              {member.character && (
                <p className="mt-1 line-clamp-2 text-center text-xs text-mz-secondary">
                  {member.character}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
