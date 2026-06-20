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

interface TvCacheData {
  language: string
  heroItems: V2SearchResult[]
  trendingNow: V2SearchResult[]
  popularTv: V2SearchResult[]
  topRatedTv: V2SearchResult[]
  actionTv: V2SearchResult[]
  scifiTv: V2SearchResult[]
  comedyTv: V2SearchResult[]
  dramaTv: V2SearchResult[]
  mysteryTv: V2SearchResult[]
}

// In-memory cache outside component logic
let tvCache: TvCacheData | null = null
let tvCacheTime = 0
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes cache TTL

export function TvSeriesPage() {
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  const langCode = preferredLanguage ? LANGUAGE_CODES[preferredLanguage] : undefined
  const langName = preferredLanguage || ''

  // Determine if we have a cache hit matching the active preferred language
  const cacheHit = tvCache && tvCache.language === preferredLanguage

  const [heroItems, setHeroItems] = useState<V2SearchResult[]>(cacheHit ? tvCache!.heroItems : [])
  const [trendingNow, setTrendingNow] = useState<V2SearchResult[]>(cacheHit ? tvCache!.trendingNow : [])
  const [popularTv, setPopularTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.popularTv : [])
  const [topRatedTv, setTopRatedTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.topRatedTv : [])
  const [actionTv, setActionTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.actionTv : [])
  const [scifiTv, setScifiTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.scifiTv : [])
  const [comedyTv, setComedyTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.comedyTv : [])
  const [dramaTv, setDramaTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.dramaTv : [])
  const [mysteryTv, setMysteryTv] = useState<V2SearchResult[]>(cacheHit ? tvCache!.mysteryTv : [])

  const [loading, setLoading] = useState(!cacheHit)
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string>()

  const loadTvSeries = useCallback(async () => {
    // Skip loading if cached data is fresh and languages match
    const activeCacheHit = tvCache && tvCache.language === preferredLanguage
    if (activeCacheHit && Date.now() - tvCacheTime < CACHE_TTL_MS) {
      return
    }

    // Only show loader skeletons if we don't have matching cached contents
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
      let actionData: V2SearchResult[] = []
      let scifiData: V2SearchResult[] = []
      let comedyData: V2SearchResult[] = []
      let dramaData: V2SearchResult[] = []
      let mysteryData: V2SearchResult[] = []

      if (langCode) {
        // Fetch language-specific TV series data using TMDB Discover
        ;[
          heroData,
          trendingData,
          popularData,
          topRatedData,
          actionData,
          scifiData,
          comedyData,
          dramaData,
          mysteryData,
        ] = await Promise.all([
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'popularity.desc' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'vote_average.desc', 'vote_count.gte': '10' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, with_genres: '10759' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, with_genres: '10765' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, with_genres: '35' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, with_genres: '18' }),
          getTmdbList('discover', { type: 'tv', with_original_language: langCode, with_genres: '9648' }),
        ])
      } else {
        // Fetch global TV series data
        ;[
          heroData,
          trendingData,
          popularData,
          topRatedData,
          actionData,
          scifiData,
          comedyData,
          dramaData,
          mysteryData,
        ] = await Promise.all([
          getTmdbList('trending', { time: 'week', media: 'tv' }),
          getTmdbList('trending', { time: 'day', media: 'tv' }),
          getTmdbList('popular_tv'),
          getTmdbList('discover', { type: 'tv', sort_by: 'vote_average.desc', 'vote_count.gte': '20' }),
          getTmdbList('discover', { type: 'tv', with_genres: '10759' }),
          getTmdbList('discover', { type: 'tv', with_genres: '10765' }),
          getTmdbList('discover', { type: 'tv', with_genres: '35' }),
          getTmdbList('discover', { type: 'tv', with_genres: '18' }),
          getTmdbList('discover', { type: 'tv', with_genres: '9648' }),
        ])
      }

      const nextHero = heroData.slice(0, 5)

      setHeroItems(nextHero)
      setTrendingNow(trendingData)
      setPopularTv(popularData)
      setTopRatedTv(topRatedData)
      setActionTv(actionData)
      setScifiTv(scifiData)
      setComedyTv(comedyData)
      setDramaTv(dramaData)
      setMysteryTv(mysteryData)

      // Update in-memory cache
      tvCache = {
        language: preferredLanguage,
        heroItems: nextHero,
        trendingNow: trendingData,
        popularTv: popularData,
        topRatedTv: topRatedData,
        actionTv: actionData,
        scifiTv: scifiData,
        comedyTv: comedyData,
        dramaTv: dramaData,
        mysteryTv: mysteryData,
      }
      tvCacheTime = Date.now()
    } catch (err) {
      console.error('Failed to load TMDB TV Series:', err)
      // Only show error screen if we have no cache to fall back on
      if (!activeCacheHit) {
        setError(true)
        setErrorMessage('Could not load TV Series. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }, [langCode, preferredLanguage])

  useEffect(() => {
    loadTvSeries()
  }, [loadTvSeries])

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
        <ErrorState message={errorMessage} onRetry={loadTvSeries} />
      </PageContainer>
    )
  }

  const titleSuffix = langName ? ` (${langName})` : ''

  return (
    <div className="pb-16 bg-mz-background">
      {/* Hero Banner Section */}
      {heroItems.length > 0 && <HeroBanner items={heroItems} layout="curved" />}

      <div className="-mt-10 relative z-20 md:-mt-16 space-y-6">
        {/* Trending TV Shows */}
        <ContentGrid title={`Trending TV Shows${titleSuffix}`} items={trendingNow} showRank />

        {/* Popular TV Shows */}
        <ContentGrid title={`Popular TV Shows${titleSuffix}`} items={popularTv} />

        {/* Top Rated TV Shows */}
        <ContentGrid title={`Top Rated TV Series${titleSuffix}`} items={topRatedTv} showRank />

        {/* Action & Adventure TV Shows */}
        <ContentGrid title={langName ? `${langName} Action & Adventure` : 'Action & Adventure'} items={actionTv} />

        {/* Sci-Fi & Fantasy TV Shows */}
        <ContentGrid title={langName ? `${langName} Sci-Fi & Fantasy` : 'Sci-Fi & Fantasy'} items={scifiTv} />

        {/* Comedy TV Shows */}
        <ContentGrid title={langName ? `${langName} Comedy Series` : 'Comedy Series'} items={comedyTv} />

        {/* Drama TV Shows */}
        <ContentGrid title={langName ? `${langName} Drama Series` : 'Drama Series'} items={dramaTv} />

        {/* Mystery TV Shows */}
        <ContentGrid title={langName ? `${langName} Mystery & Thriller` : 'Mystery & Thriller'} items={mysteryTv} />
      </div>
    </div>
  )
}
