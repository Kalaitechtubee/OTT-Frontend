import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, RefreshCw } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PosterCard } from '@/components/common/PosterCard'
import { Shimmer } from '@/components/common/Shimmer'
import { ErrorState } from '@/components/common/ErrorState'
import {
  categoryTitle,
  resolveLanguage,
  type HubCategoryId,
} from '@/core/constants/languages'
import { ApiHttpError, searchV2, getTmdbList } from '@/services/api'
import { paths } from '@/routes/paths'
import type { V2SearchResult } from '@/types/v2'

const LANGUAGE_CODES: Record<string, string> = {
  Tamil: 'ta',
  Telugu: 'te',
  Malayalam: 'ml',
  Kannada: 'kn',
}

export function LanguageCategoryPage() {
  const { lang = 'Tamil', category = 'trending' } = useParams<{
    lang: string
    category: string
  }>()
  const hubLanguage = resolveLanguage(lang)
  const categoryId = category as HubCategoryId
  const title = categoryTitle(hubLanguage, categoryId)

  const [items, setItems] = useState<V2SearchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string>()
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  const loaderRef = useRef<HTMLDivElement>(null)

  const load = useCallback(
    async (force = false) => {
      setLoading(true)
      setError(undefined)
      setPage(1)
      setHasMore(true)
      try {
        const langCode = LANGUAGE_CODES[hubLanguage] || 'ta'
        let list: V2SearchResult[] = []

        if (categoryId === 'movies') {
          list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc', page: '1' })
        } else if (categoryId === 'series') {
          list = await getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'popularity.desc', page: '1' })
        } else if (categoryId === 'dubbed') {
          list = await searchV2(`${hubLanguage} Dubbed`, { force })
        } else if (categoryId === 'new_releases') {
          list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'release_date.desc', 'vote_count.gte': '5', page: '1' })
        } else {
          // trending
          list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc', page: '1' })
        }

        setItems(list)
        if (list.length < 20 || categoryId === 'dubbed') {
          setHasMore(false)
        }
      } catch (err) {
        setError(
          err instanceof ApiHttpError
            ? err.message
            : 'Could not load this category. Please try again.',
        )
      } finally {
        setLoading(false)
      }
    },
    [hubLanguage, categoryId],
  )

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return
    setLoadingMore(true)
    const nextPage = page + 1

    try {
      const langCode = LANGUAGE_CODES[hubLanguage] || 'ta'
      let list: V2SearchResult[] = []

      if (categoryId === 'movies') {
        list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc', page: String(nextPage) })
      } else if (categoryId === 'series') {
        list = await getTmdbList('discover', { type: 'tv', with_original_language: langCode, sort_by: 'popularity.desc', page: String(nextPage) })
      } else if (categoryId === 'new_releases') {
        list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'release_date.desc', 'vote_count.gte': '5', page: String(nextPage) })
      } else if (categoryId !== 'dubbed') {
        // trending
        list = await getTmdbList('discover', { type: 'movie', with_original_language: langCode, sort_by: 'popularity.desc', page: String(nextPage) })
      }

      if (list.length > 0) {
        setItems((prev) => [...prev, ...list])
        setPage(nextPage)
      }
      
      if (list.length < 20) {
        setHasMore(false)
      }
    } catch (err) {
      console.error('Failed to load more items:', err)
    } finally {
      setLoadingMore(false)
    }
  }, [page, hasMore, loading, loadingMore, hubLanguage, categoryId])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    const currentLoader = loaderRef.current
    if (currentLoader) {
      observer.observe(currentLoader)
    }

    return () => {
      if (currentLoader) {
        observer.unobserve(currentLoader)
      }
    }
  }, [loadMore, hasMore, loading, loadingMore])

  useEffect(() => {
    load(false)
  }, [load])

  return (
    <PageContainer className="py-10">
      <Link
        to={paths.languageHub(hubLanguage)}
        className="mb-6 inline-flex items-center gap-1 text-sm text-mz-secondary hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
        {hubLanguage} Hub
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">{title}</h1>
          {!loading && !error && (
            <p className="mt-2 text-mz-secondary">
              {categoryId === 'movies'
                ? `Explore the collection of ${hubLanguage} movies`
                : categoryId === 'series'
                ? `Explore the collection of ${hubLanguage} TV series`
                : categoryId === 'dubbed'
                ? `Explore ${hubLanguage} dubbed content`
                : categoryId === 'new_releases'
                ? `Explore new ${hubLanguage} releases`
                : `Explore trending ${hubLanguage} titles`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {loading && items.length === 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Shimmer key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && items.length === 0 && (
        <div className="mt-12">
          <ErrorState message={error} onRetry={() => load(true)} />
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="mt-12 text-center text-mz-secondary">
          No titles in this section yet. Try refreshing later.
        </p>
      )}

      {items.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {items.map((result, i) => (
            <PosterCard key={`${result.provider}-${result.id}-${i}`} result={result} variant="grid" />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Shimmer key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      )}

      {hasMore && !loading && (
        <div ref={loaderRef} className="mt-8 flex justify-center py-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="btn-secondary px-6 py-2 text-xs font-semibold text-mz-secondary hover:text-white"
          >
            {loadingMore ? 'Loading more...' : 'Load More'}
          </button>
        </div>
      )}
    </PageContainer>
  )
}
