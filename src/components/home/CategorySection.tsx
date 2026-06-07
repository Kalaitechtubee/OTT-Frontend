import { ChevronRight } from 'lucide-react'

interface CategorySectionProps {
  selectedGenre: string | null
  setSelectedGenre: (genre: string | null) => void
}

const GENRES = [
  'Action',
  'Animation',
  'Comedy',
  'Crime',
  'Documentary',
  'Drama',
  'Horror',
  'Music',
  'Romance',
  'Sci-Fi',
  'Thriller',
  'Western',
]

export function CategorySection({
  selectedGenre,
  setSelectedGenre,
}: CategorySectionProps) {
  return (
    <div className="surface-card relative overflow-hidden p-5 sm:p-6">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-mz-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-mz-primary/3 blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-1.5">
          <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl lg:text-2xl">
            Browse Movies & TV Shows
          </h2>
          <ChevronRight className="h-5 w-5 text-mz-primary" />
        </div>
        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-mz-primary/50">
          On Demand
        </p>

        <div className="no-scrollbar -mx-5 mt-5 flex gap-2.5 overflow-x-auto px-5 pb-1.5 scroll-smooth sm:-mx-6 sm:px-6">
          {GENRES.map((genre) => {
            const active = selectedGenre === genre
            return (
              <button
                key={genre}
                type="button"
                onClick={() => setSelectedGenre(active ? null : genre)}
                className={`chip ${active ? 'chip-active' : ''}`}
              >
                {genre}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
