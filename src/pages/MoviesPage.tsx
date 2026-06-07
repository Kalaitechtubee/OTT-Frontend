import { useCallback, useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { HeroBanner } from '@/components/home/HeroBanner'
import { ContentGrid } from '@/components/home/ContentGrid'
import { ErrorState } from '@/components/common/ErrorState'
import { Shimmer } from '@/components/common/Shimmer'
import { getTmdbList } from '@/services/api'
import { useAppStore } from '@/store/appStore'
import type { V2SearchResult } from '@/types/v2'

const LANGUAGE_CODES: Record<string, string> = {
  Tamil: 'ta',
  Telugu: 'te',
  Malayalam: 'ml',
  Kannada: 'kn',
}

interface MoviesCacheData {
  language: string
  heroItems: V2SearchResult[]
  trendingNow: V2SearchResult[]
  popularMovies: V2SearchResult[]
  topRated: V2SearchResult[]
  upcomingMovies: V2SearchResult[]
  actionMovies: V2SearchResult[]
  comedyMovies: V2SearchResult[]
  horrorMovies: V2SearchResult[]
  scifiMovies: V2SearchResult[]
}

// In-memory cache outside component logic
let moviesCache: MoviesCacheData | null = null

export function MoviesPage() {
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  const langCode = preferredLanguage ? LANGUAGE_CODES[preferredLanguage] : undefined
  const langName = preferredLanguage || ''

  // Determine if we have a cache hit matching the active preferred language
  const cacheHit = moviesCache && moviesCache.language === preferredLanguage

  const [heroItems, setHeroItems] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.heroItems : [])
  const [trendingNow, setTrendingNow] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.trendingNow : [])
  const [popularMovies, setPopularMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.popularMovies : [])
  const [topRated, setTopRated] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.topRated : [])
  const [upcomingMovies, setUpcomingMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.upcomingMovies : [])
  const [actionMovies, setActionMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.actionMovies : [])
  const [comedyMovies, setComedyMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.comedyMovies : [])
  const [horrorMovies, setHorrorMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.horrorMovies : [])
  const [scifiMovies, setScifiMovies] = useState<V2SearchResult[]>(cacheHit ? moviesCache!.scifiMovies : [])

  const [loading, setLoading] = useState(!cacheHit)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const loadMovies = useCallback(async () => {
    // Only show loader skeletons if we don't have matching cached contents
    const activeCacheHit = moviesCache && moviesCache.language === preferredLanguage
    if (!activeCacheHit) {
      setLoading(true)
    }
    setError(false)
    setErrorMessage(undefined)

    try {
      let heroData: V2SearchResult[] = []
      let trendingData: V2SearchResult[] = []
      let popularData: V2SearchResult[] = []
      let topRatedData: V2SearchResult[] = []
      let upcomingData: V2SearchResult[] = []
      let actionData: V2SearchResult[] = []
      let comedyData: V2SearchResult[] = []
      let horrorData: V2SearchResult[] = []
      let scifiData: V2SearchResult[] = []

      if (langCode) {
        // Fetch language-specific movie data using TMDB Discover
        ;[
          heroData,
          trendingData,
          popularData,
          topRatedData,
          upcomingData,
          actionData,
          comedyData,
          horrorData,
          scifiData,
        ] = await Promise.all([
          // For language-specific hero items, discover highly popular movies of that language
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'vote_average.desc', 'vote_count.gte': '20' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'release_date.desc', 'vote_count.gte': '5' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, with_genres: '28' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, with_genres: '35' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, with_genres: '27' }),
          getTmdbList('discover', { type: 'movie', with_original_language: langCode, with_genres: '878' }),
        ])
      } else {
        // Fetch global movie data
        ;[
          heroData,
          trendingData,
          popularData,
          topRatedData,
          upcomingData,
          actionData,
          comedyData,
          horrorData,
          scifiData,
        ] = await Promise.all([
          getTmdbList('trending', { time: 'week', media: 'movie' }),
          getTmdbList('trending', { time: 'day', media: 'movie' }),
          getTmdbList('popular'),
          getTmdbList('top_rated'),
          getTmdbList('upcoming'),
          getTmdbList('discover', { type: 'movie', with_genres: '28' }),
          getTmdbList('discover', { type: 'movie', with_genres: '35' }),
          getTmdbList('discover', { type: 'movie', with_genres: '27' }),
          getTmdbList('discover', { type: 'movie', with_genres: '878' }),
        ])
      }

      const nextHero = heroData.slice(0, 5)

      setHeroItems(nextHero)
      setTrendingNow(trendingData)
      setPopularMovies(popularData)
      setTopRated(topRatedData)
      setUpcomingMovies(upcomingData)
      setActionMovies(actionData)
      setComedyMovies(comedyData)
      setHorrorMovies(horrorData)
      setScifiMovies(scifiData)

      // Update in-memory cache
      moviesCache = {
        language: preferredLanguage,
        heroItems: nextHero,
        trendingNow: trendingData,
        popularMovies: popularData,
        topRated: topRatedData,
        upcomingMovies: upcomingData,
        actionMovies: actionData,
        comedyMovies: comedyData,
        horrorMovies: horrorData,
        scifiMovies: scifiData,
      }
    } catch (err) {
      console.error('Failed to load TMDB movies:', err)
      // Only show error screen if we have no cache to fall back on
      if (!activeCacheHit) {
        setError(true)
        setErrorMessage('Could not load movies. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [langCode, preferredLanguage])

  useEffect(() => {
    loadMovies()
  }, [loadMovies])

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
        <ErrorState message={errorMessage} onRetry={loadMovies} />
      </PageContainer>
    )
  }

  const titleSuffix = langName ? ` (${langName})` : ''

  return (
    <div className="pb-16 bg-mz-background">
      {/* Hero Banner Section */}
      {heroItems.length > 0 && <HeroBanner items={heroItems} layout="curved" />}

      <div className="-mt-10 relative z-20 md:-mt-16 space-y-6">
        {/* Trending Movies */}
        <ContentGrid title={`Trending Movies${titleSuffix}`} items={trendingNow} showRank />

        {/* Popular Movies */}
        <ContentGrid title={`Popular Movies${titleSuffix}`} items={popularMovies} />

        {/* Top Rated Movies */}
        <ContentGrid title={`Top Rated Movies${titleSuffix}`} items={topRated} showRank />

        {/* Upcoming Movies */}
        <ContentGrid title={langName ? `New ${langName} Releases` : 'Upcoming Releases'} items={upcomingMovies} />

        {/* Action Movies */}
        <ContentGrid title={langName ? `${langName} Action & Adventure` : 'Action & Adventure'} items={actionMovies} />

        {/* Comedy Movies */}
        <ContentGrid title={langName ? `${langName} Comedy Specials` : 'Comedy Specials'} items={comedyMovies} />

        {/* Horror Movies */}
        <ContentGrid title={langName ? `${langName} Spooky & Horror` : 'Spooky & Horror'} items={horrorMovies} />

        {/* Sci-Fi Movies */}
        <ContentGrid title={langName ? `${langName} Science Fiction` : 'Science Fiction'} items={scifiMovies} />
      </div>
    </div>
  )
}
