import { useEffect } from 'react'
import { PageContainer } from '@/components/layout/PageContainer'
import { HeroBanner } from '@/components/home/HeroBanner'
import { ContentGrid } from '@/components/home/ContentGrid'
import { ErrorState } from '@/components/common/ErrorState'
import { Shimmer } from '@/components/common/Shimmer'
import { useAppStore } from '@/store/appStore'
import { useCatalogStore } from '@/store/catalogStore'

const LANGUAGE_CODES: Record<string, string> = {
  Tamil: 'ta',
  Telugu: 'te',
  Malayalam: 'ml',
  Kannada: 'kn',
}

export function TvSeriesPage() {
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  const langCode = preferredLanguage ? LANGUAGE_CODES[preferredLanguage] : undefined
  const langName = preferredLanguage || ''

  const tvCatalog = useCatalogStore((s) => s.tvCatalog?.data)
  const cacheHit = tvCatalog && tvCatalog.language === preferredLanguage
  const loading = useCatalogStore((s) => s.loading['tv'])
  const error = useCatalogStore((s) => s.errors['tv'])
  const fetchTvCatalog = useCatalogStore((s) => s.fetchTvCatalog)

  useEffect(() => {
    void fetchTvCatalog(preferredLanguage, langCode)
  }, [fetchTvCatalog, preferredLanguage, langCode])

  if (loading && !cacheHit) {
    return (
      <div className="min-h-screen bg-mz-background pb-16">
        <Shimmer className="w-full rounded-none" style={{ height: '56vw', maxHeight: 480, minHeight: 280 }} />
        <div className="mt-6 space-y-8 px-5 sm:px-8 lg:px-10">
          {Array.from({ length: 3 }).map((_, rIdx) => (
            <div key={rIdx} className="space-y-3">
              <Shimmer className="h-5 w-40 rounded-md" />
              <div className="-mx-5 flex gap-3 overflow-x-auto no-scrollbar px-5 sm:-mx-8 sm:px-8 lg:-mx-10 lg:px-10 pb-2">
                {Array.from({ length: 8 }).map((_, cIdx) => (
                  <Shimmer key={cIdx} className="aspect-[2/3] w-[130px] sm:w-[150px] lg:w-[160px] shrink-0 rounded-xl" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error && !cacheHit) {
    return (
      <PageContainer className="py-16">
        <ErrorState message={error} onRetry={() => fetchTvCatalog(preferredLanguage, langCode, 0)} />
      </PageContainer>
    )
  }

  if (!cacheHit || !tvCatalog) return null

  const {
    heroItems,
    trendingNow,
    popularTv,
    topRatedTv,
    actionTv,
    scifiTv,
    comedyTv,
    dramaTv,
    mysteryTv,
  } = tvCatalog

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

