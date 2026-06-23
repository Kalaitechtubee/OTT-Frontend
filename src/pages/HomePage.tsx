import { useEffect } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { HeroBanner } from '@/components/home/HeroBanner'
import { ContentGrid } from '@/components/home/ContentGrid'
import { ContinueWatchingSection } from '@/components/home/ContinueWatchingSection'
import { ErrorState } from '@/components/common/ErrorState'
import { Shimmer } from '@/components/common/Shimmer'
import { useCatalogStore } from '@/store/catalogStore'

export function HomePage() {
  const homeCatalog = useCatalogStore((s) => s.homeCatalog?.data)
  const loading = useCatalogStore((s) => s.loading['home'])
  const error = useCatalogStore((s) => s.errors['home'])
  const fetchHomeCatalog = useCatalogStore((s) => s.fetchHomeCatalog)

  useEffect(() => {
    void fetchHomeCatalog()
  }, [fetchHomeCatalog])

  if (loading && !homeCatalog) {
    return (
      <div className="min-h-screen bg-mz-background pb-16">
        {/* Hero Banner Shimmer — full-width, matches real HeroBanner */}
        <Shimmer className="w-full rounded-none" style={{ height: '56vw', maxHeight: 480, minHeight: 280 }} />

        {/* Rails Shimmer */}
        <div className="mt-6 space-y-8 px-5 sm:px-8 lg:px-10">
          {Array.from({ length: 3 }).map((_, rIdx) => (
            <div key={rIdx} className="space-y-3">
              {/* Section title shimmer */}
              <Shimmer className="h-5 w-40 rounded-md" />
              {/* Cards rail — bleeds to screen edge like ContentGrid */}
              <div
                className="-mx-5 flex gap-3 overflow-x-auto no-scrollbar px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10 pb-2"
              >
                {Array.from({ length: 8 }).map((_, cIdx) => (
                  <Shimmer
                    key={cIdx}
                    className="aspect-[2/3] w-[130px] sm:w-[150px] lg:w-[160px] shrink-0 rounded-xl"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !homeCatalog) {
    return (
      <PageContainer className="py-16">
        <ErrorState message={error} onRetry={() => fetchHomeCatalog(0)} />
      </PageContainer>
    )
  }

  if (!homeCatalog) return null

  const {
    heroItems,
    trendingNow,
    popularMovies,
    topRated,
    tamilMovies,
    teluguMovies,
    hindiMovies,
    malayalamMovies,
    kannadaMovies,
    koreanMovies,
    actionMovies,
    comedyMovies,
    horrorMovies,
    scifiMovies,
    animationMovies,
    thrillerMovies,
    romanceMovies,
    popularTv,
    upcomingMovies,
    recommended,
  } = homeCatalog

  // Gather all unique poster images fetched from all rails to feed into the HeroBanner collage background
  const allPosters = Array.from(
    new Set(
      [
        ...heroItems,
        ...trendingNow,
        ...popularMovies,
        ...topRated,
        ...tamilMovies,
        ...teluguMovies,
        ...hindiMovies,
        ...malayalamMovies,
        ...kannadaMovies,
        ...koreanMovies,
        ...actionMovies,
        ...comedyMovies,
        ...horrorMovies,
        ...scifiMovies,
        ...animationMovies,
        ...thrillerMovies,
        ...romanceMovies,
        ...popularTv,
        ...upcomingMovies,
        ...recommended,
      ]
        .map((item) => item.poster)
        .filter((url): url is string => Boolean(url))
    )
  )

  return (
    <div className="pb-16 bg-mz-background">
      {/* 1. Hero Banner Section */}
      {heroItems.length > 0 && <HeroBanner items={heroItems} allPosters={allPosters} />}

      <div className="-mt-10 relative z-20 md:-mt-16 space-y-6">
        {/* 2. Trending Now (Landscape Banner style) */}
        <ContentGrid title="Trending Now" items={trendingNow} showRank variant="trending" />

        {/* 3. Continue Watching */}
        <ContinueWatchingSection />

        {/* 4. Popular Movies (Glassmorphic detailed portrait) */}
        <ContentGrid title="Popular Movies" items={popularMovies} variant="large" />

        {/* 5. Top Rated (Glassmorphic detailed portrait with ranks) */}
        <ContentGrid title="Top Rated Movies" items={topRated} showRank variant="large" />

        {/* 6. Tamil Movies (Glassmorphic detailed portrait) */}
        <ContentGrid title="Tamil Cinema Hits" items={tamilMovies} variant="large" />

        {/* 7. Telugu Movies (Classic Portrait poster) */}
        <ContentGrid title="Telugu Blockbusters" items={teluguMovies} variant="rail" />

        {/* 8. Hindi Movies (Landscape Banner style) */}
        <ContentGrid title="Bollywood Hits" items={hindiMovies} variant="trending" />

        {/* 9. Malayalam Movies (Glassmorphic detailed portrait) */}
        <ContentGrid title="Malayalam Cinema Hits" items={malayalamMovies} variant="large" />

        {/* 10. Kannada Movies (Classic Portrait poster) */}
        <ContentGrid title="Kannada Cinema Hits" items={kannadaMovies} variant="rail" />

        {/* 11. Korean Movies (Landscape Banner style) */}
        <ContentGrid title="K-Dramas & Korean Cinema" items={koreanMovies} variant="trending" />

        {/* 12. Action Movies (Landscape Banner style) */}
        <ContentGrid title="Action & Adventure" items={actionMovies} variant="trending" />

        {/* 13. Comedy Movies (Classic Portrait poster) */}
        <ContentGrid title="Comedy Specials" items={comedyMovies} variant="rail" />

        {/* 14. Animation & Anime (Glassmorphic detailed portrait) */}
        <ContentGrid title="Animation & Anime" items={animationMovies} variant="large" />

        {/* 15. Suspense Thrillers (Landscape Banner style) */}
        <ContentGrid title="Suspense & Thrillers" items={thrillerMovies} variant="trending" />

        {/* 16. Horror Movies (Classic Portrait poster) */}
        <ContentGrid title="Spooky & Horror" items={horrorMovies} variant="rail" />

        {/* 17. Romance Movies (Glassmorphic detailed portrait) */}
        <ContentGrid title="Romantic Hits" items={romanceMovies} variant="large" />

        {/* 18. Sci-Fi Movies (Landscape Banner style) */}
        <ContentGrid title="Science Fiction" items={scifiMovies} variant="trending" />

        {/* 19. Popular TV Shows (Classic Portrait poster) */}
        <ContentGrid title="Popular TV Shows" items={popularTv} variant="rail" />

        {/* 20. Upcoming Movies (Glassmorphic detailed portrait) */}
        <ContentGrid title="Upcoming Releases" items={upcomingMovies} variant="large" />

        {/* 21. Recommended For You (Landscape Banner style) */}
        <ContentGrid title="Recommended For You" items={recommended} variant="trending" />
      </div>
    </div>
  )
}

