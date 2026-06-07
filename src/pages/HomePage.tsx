import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { HeroBanner } from '@/components/home/HeroBanner'
import { ContentGrid } from '@/components/home/ContentGrid'
import { ContinueWatchingSection } from '@/components/home/ContinueWatchingSection'
import { ErrorState } from '@/components/common/ErrorState'
import { Shimmer } from '@/components/common/Shimmer'
import { getTmdbList } from '@/services/api'
import type { V2SearchResult } from '@/types/v2'

interface HomeCacheData {
  heroItems: V2SearchResult[]
  trendingNow: V2SearchResult[]
  popularMovies: V2SearchResult[]
  topRated: V2SearchResult[]
  tamilMovies: V2SearchResult[]
  teluguMovies: V2SearchResult[]
  hindiMovies: V2SearchResult[]
  malayalamMovies: V2SearchResult[]
  kannadaMovies: V2SearchResult[]
  koreanMovies: V2SearchResult[]
  actionMovies: V2SearchResult[]
  comedyMovies: V2SearchResult[]
  horrorMovies: V2SearchResult[]
  scifiMovies: V2SearchResult[]
  animationMovies: V2SearchResult[]
  thrillerMovies: V2SearchResult[]
  romanceMovies: V2SearchResult[]
  popularTv: V2SearchResult[]
  upcomingMovies: V2SearchResult[]
  recommended: V2SearchResult[]
}

// In-memory cache outside the React cycle to persist loaded content across mounts
let homeCache: HomeCacheData | null = null

export function HomePage() {
  const [heroItems, setHeroItems] = useState<V2SearchResult[]>(homeCache?.heroItems ?? [])
  const [trendingNow, setTrendingNow] = useState<V2SearchResult[]>(homeCache?.trendingNow ?? [])
  const [popularMovies, setPopularMovies] = useState<V2SearchResult[]>(homeCache?.popularMovies ?? [])
  const [topRated, setTopRated] = useState<V2SearchResult[]>(homeCache?.topRated ?? [])
  const [tamilMovies, setTamilMovies] = useState<V2SearchResult[]>(homeCache?.tamilMovies ?? [])
  const [teluguMovies, setTeluguMovies] = useState<V2SearchResult[]>(homeCache?.teluguMovies ?? [])
  const [hindiMovies, setHindiMovies] = useState<V2SearchResult[]>(homeCache?.hindiMovies ?? [])
  const [malayalamMovies, setMalayalamMovies] = useState<V2SearchResult[]>(homeCache?.malayalamMovies ?? [])
  const [kannadaMovies, setKannadaMovies] = useState<V2SearchResult[]>(homeCache?.kannadaMovies ?? [])
  const [koreanMovies, setKoreanMovies] = useState<V2SearchResult[]>(homeCache?.koreanMovies ?? [])
  const [actionMovies, setActionMovies] = useState<V2SearchResult[]>(homeCache?.actionMovies ?? [])
  const [comedyMovies, setComedyMovies] = useState<V2SearchResult[]>(homeCache?.comedyMovies ?? [])
  const [horrorMovies, setHorrorMovies] = useState<V2SearchResult[]>(homeCache?.horrorMovies ?? [])
  const [scifiMovies, setScifiMovies] = useState<V2SearchResult[]>(homeCache?.scifiMovies ?? [])
  const [animationMovies, setAnimationMovies] = useState<V2SearchResult[]>(homeCache?.animationMovies ?? [])
  const [thrillerMovies, setThrillerMovies] = useState<V2SearchResult[]>(homeCache?.thrillerMovies ?? [])
  const [romanceMovies, setRomanceMovies] = useState<V2SearchResult[]>(homeCache?.romanceMovies ?? [])
  const [popularTv, setPopularTv] = useState<V2SearchResult[]>(homeCache?.popularTv ?? [])
  const [upcomingMovies, setUpcomingMovies] = useState<V2SearchResult[]>(homeCache?.upcomingMovies ?? [])
  const [recommended, setRecommended] = useState<V2SearchResult[]>(homeCache?.recommended ?? [])

  const [loading, setLoading] = useState(!homeCache)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const loadCatalog = useCallback(async () => {
    // Only trigger full visual loading/shimmer if we don't have cached content
    const hasCache = !!homeCache
    if (!hasCache) {
      setLoading(true)
    }
    setError(false)
    setErrorMessage(undefined)

    try {
      const [
        heroData,
        trendingData,
        popularData,
        topRatedData,
        tamilData,
        teluguData,
        hindiData,
        malayalamData,
        kannadaData,
        koreanData,
        actionData,
        comedyData,
        horrorData,
        scifiData,
        animationData,
        thrillerData,
        romanceData,
        popularTvData,
        upcomingData,
        recData,
      ] = await Promise.all([
        getTmdbList('trending', { time: 'week', media: 'all' }),
        getTmdbList('trending', { time: 'day', media: 'movie' }),
        getTmdbList('popular'),
        getTmdbList('top_rated'),
        getTmdbList('discover', { with_original_language: 'ta' }),
        getTmdbList('discover', { with_original_language: 'te' }),
        getTmdbList('discover', { with_original_language: 'hi' }),
        getTmdbList('discover', { with_original_language: 'ml' }),
        getTmdbList('discover', { with_original_language: 'kn' }),
        getTmdbList('discover', { with_original_language: 'ko' }),
        getTmdbList('discover', { with_genres: '28' }),
        getTmdbList('discover', { with_genres: '35' }),
        getTmdbList('discover', { with_genres: '27' }),
        getTmdbList('discover', { with_genres: '878' }),
        getTmdbList('discover', { with_genres: '16' }),
        getTmdbList('discover', { with_genres: '53' }),
        getTmdbList('discover', { with_genres: '10749' }),
        getTmdbList('popular_tv'),
        getTmdbList('upcoming'),
        getTmdbList('discover', { with_origin_country: 'IN' }), // Indian hits as recommendations fallback
      ])

      const nextHero = heroData.slice(0, 5)

      setHeroItems(nextHero)
      setTrendingNow(trendingData)
      setPopularMovies(popularData)
      setTopRated(topRatedData)
      setTamilMovies(tamilData)
      setTeluguMovies(teluguData)
      setHindiMovies(hindiData)
      setMalayalamMovies(malayalamData)
      setKannadaMovies(kannadaData)
      setKoreanMovies(koreanData)
      setActionMovies(actionData)
      setComedyMovies(comedyData)
      setHorrorMovies(horrorData)
      setScifiMovies(scifiData)
      setAnimationMovies(animationData)
      setThrillerMovies(thrillerData)
      setRomanceMovies(romanceData)
      setPopularTv(popularTvData)
      setUpcomingMovies(upcomingData)
      setRecommended(recData)

      // Update in-memory cache
      homeCache = {
        heroItems: nextHero,
        trendingNow: trendingData,
        popularMovies: popularData,
        topRated: topRatedData,
        tamilMovies: tamilData,
        teluguMovies: teluguData,
        hindiMovies: hindiData,
        malayalamMovies: malayalamData,
        kannadaMovies: kannadaData,
        koreanMovies: koreanData,
        actionMovies: actionData,
        comedyMovies: comedyData,
        horrorMovies: horrorData,
        scifiMovies: scifiData,
        animationMovies: animationData,
        thrillerMovies: thrillerData,
        romanceMovies: romanceData,
        popularTv: popularTvData,
        upcomingMovies: upcomingData,
        recommended: recData,
      }
    } catch (err) {
      console.error('Failed to load TMDB catalog:', err)
      // Only show visual error state if we have nothing cached to display
      if (!homeCache) {
        setError(true)
        setErrorMessage('Could not load the catalog. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCatalog()
  }, [loadCatalog])

  if (loading && heroItems.length === 0) {
    return (
      <div className="min-h-screen bg-mz-background pb-12 pt-8">
        <PageContainer className="space-y-8">
          {/* Hero Banner Shimmer */}
          <Shimmer className="aspect-[21/9] min-h-[350px] w-full rounded-2xl" />
          
          {/* Rails Shimmer */}
          {Array.from({ length: 4 }).map((_, rIdx) => (
            <div key={rIdx} className="space-y-4 pt-4">
              <Shimmer className="h-8 w-48 rounded" />
              <div className="flex gap-4 overflow-x-hidden">
                {Array.from({ length: 6 }).map((_, cIdx) => (
                  <Shimmer key={cIdx} className="aspect-[2/3] w-[150px] sm:w-[170px] shrink-0 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </PageContainer>
      </div>
    )
  }

  if (error && heroItems.length === 0) {
    return (
      <PageContainer className="py-16">
        <ErrorState message={errorMessage} onRetry={loadCatalog} />
      </PageContainer>
    )
  }

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
