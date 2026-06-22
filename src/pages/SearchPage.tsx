import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, Search, X, Flame } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PosterCard } from '@/components/common/PosterCard'
import { Shimmer } from '@/components/common/Shimmer'
import { searchV2, ApiHttpError, getTmdbList } from '@/services/api'
import { useAppStore } from '@/store/appStore'
import type { V2SearchResult } from '@/types/v2'
import { paths } from '@/routes/paths'

const LANGUAGE_CODES: Record<string, string> = {
  Tamil: 'ta',
  Telugu: 'te',
  Malayalam: 'ml',
  Kannada: 'kn',
}

interface LangText {
  title: string
  subtitle: string
  placeholder: string
  popularLabel: string
  emptyText: string
  noResults: string
  resultsCount: string
}

const TEXTS: Record<string, LangText> = {
  Tamil: {
    title: 'Search Tamil Hub',
    subtitle: 'Search and discover Tamil blockbusters, TV series and dubbed movies across all catalogs',
    placeholder: 'e.g. amaran, leo, jailer, mersal...',
    popularLabel: 'Popular Tamil Searches',
    emptyText: 'Enter at least 2 characters to search the Tamil catalog.',
    noResults: 'No results found for',
    resultsCount: 'results found'
  },
  Telugu: {
    title: 'Search Telugu Hub',
    subtitle: 'Search and discover Telugu blockbusters, TV series and dubbed movies across all catalogs',
    placeholder: 'e.g. pushpa, rrr, devara, salaar...',
    popularLabel: 'Popular Telugu Searches',
    emptyText: 'Enter at least 2 characters to search the Telugu catalog.',
    noResults: 'No results found for',
    resultsCount: 'results found'
  },
  Malayalam: {
    title: 'Search Malayalam Hub',
    subtitle: 'Search and discover Malayalam cinema, dramas and premium streaming across all catalogs',
    placeholder: 'e.g. manjummel boys, premalu, aavesham, bramayugam...',
    popularLabel: 'Popular Malayalam Searches',
    emptyText: 'Enter at least 2 characters to search the Malayalam catalog.',
    noResults: 'No results found for',
    resultsCount: 'results found'
  },
  Kannada: {
    title: 'Search Kannada Hub',
    subtitle: 'Search and discover Kannada cinema, classics and upcoming movies across all catalogs',
    placeholder: 'e.g. kgf, kantara, charlie 777, vikrant rona...',
    popularLabel: 'Popular Kannada Searches',
    emptyText: 'Enter at least 2 characters to search the Kannada catalog.',
    noResults: 'No results found for',
    resultsCount: 'results found'
  },
}

const DEFAULT_TEXTS: LangText = {
  title: 'Search Catalog',
  subtitle: 'Search and discover movies, TV series and shows across Net11 and Net52 V2 catalogs',
  placeholder: 'e.g. stranger things, pushpa, amaran, leo...',
  popularLabel: 'Trending Searches',
  emptyText: 'Enter at least 2 characters to search the catalog.',
  noResults: 'No results found for',
  resultsCount: 'results found'
}

const FALLBACK_SUGGESTIONS: Record<string, string[]> = {
  Tamil: ['amaran', 'leo', 'jailer', 'vikram', 'master', 'beast', 'thunivu', 'good bad ugly', 'vidamuyarchi', 'dragon', 'retro', 'mersal'],
  Telugu: ['pushpa 2', 'rrr', 'devara', 'salaar', 'guntur kaaram', 'kalki 2898 ad', 'hanuman', 'hi nanna', 'og', 'game changer'],
  Malayalam: ['manjummel boys', 'premalu', 'aavesham', 'bramayugam', 'the goat life', 'lucifer', 'minnal murali', 'hridayam', 'romancham', 'turbo'],
  Kannada: ['kgf chapter 2', 'kantara', 'charlie 777', 'vikrant rona', 'kabzaa', 'yuva', 'bhairathi ranagal', 'ui', 'max', 'salaga'],
  default: ['pushpa 2', 'kalki 2898 ad', 'rrr', 'leo', 'kgf 2', 'jawan', 'pathaan', 'stree 2', 'animal', 'dune']
}

// Module-level search cache to survive component unmounts during SPA navigation
let searchCache: { query: string; results: V2SearchResult[] } | null = null

export function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const initial = searchParams.get('q') ?? ''
  const [query, setQuery] = useState(searchCache?.query ?? initial)
  const [results, setResults] = useState<V2SearchResult[]>(searchCache?.results ?? [])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Language state
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  const langText = TEXTS[preferredLanguage] || DEFAULT_TEXTS

  // Suggestions state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)

  // Fetch suggestions when preferred language changes
  useEffect(() => {
    let active = true
    const fetchSuggestions = async () => {
      setSuggestionsLoading(true)
      const langCode = preferredLanguage ? LANGUAGE_CODES[preferredLanguage] : undefined
      const defaultList = FALLBACK_SUGGESTIONS[preferredLanguage] || FALLBACK_SUGGESTIONS.default

      try {
        let results: V2SearchResult[] = []
        if (langCode) {
          // Fetch language-specific popular movies
          results = await getTmdbList('discover', {
            type: 'movie',
            with_original_language: langCode,
            sort_by: 'popularity.desc',
          })
        } else {
          // Fetch global trending movies
          results = await getTmdbList('trending', {
            time: 'week',
            media: 'movie',
          })
        }

        if (!active) return

        if (results && results.length > 0) {
          const titles = results
            .map((item) => item.title.trim())
            .filter((title) => {
              // Keep titles reasonably short (under 28 chars) so they render well as suggestion chips
              return title.length > 0 && title.length < 28
            })
            // Deduplicate
            .filter((title, index, self) => self.indexOf(title) === index)
            .slice(0, 12)

          if (titles.length > 0) {
            setSuggestions(titles)
          } else {
            setSuggestions(defaultList)
          }
        } else {
          setSuggestions(defaultList)
        }
      } catch (err) {
        console.error('Failed to fetch popular queries:', err)
        if (active) {
          setSuggestions(defaultList)
        }
      } finally {
        if (active) {
          setSuggestionsLoading(false)
        }
      }
    }

    fetchSuggestions()

    return () => {
      active = false
    }
  }, [preferredLanguage])

  useEffect(() => {
    setQuery(initial)
  }, [initial])

  const autoParam = searchParams.get('auto') === 'true'

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      setError(null)
      searchCache = null
      return
    }

    // Skip API request if query is already cached and loaded
    if (searchCache && searchCache.query === query.trim()) {
      setResults(searchCache.results)
      return
    }

    const controller = new AbortController()
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const items = await searchV2(query.trim(), { signal: controller.signal })
        if (controller.signal.aborted) return
        setResults(items)
        searchCache = { query: query.trim(), results: items }

        // Seamless auto-redirect for recommendations or exact search landing
        if (items.length === 1 && autoParam) {
          navigate(
            paths.detail(items[0].provider, items[0].id, {
              title: items[0].title,
              year: items[0].year,
            }),
            { replace: true },
          )
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        if (err instanceof ApiHttpError) {
          if (err.status === 429) {
            setError('Too many requests. Please wait a moment before searching again.')
          } else {
            setError(err.message || 'Failed to load search results.')
          }
        } else {
          setError('Failed to load search results. Please try again.')
        }
        setResults([])
        searchCache = null
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }

      if (query.trim().length >= 2) {
        setSearchParams({ q: query.trim() }, { replace: true })
      }
    }, 500)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query, setSearchParams, navigate, autoParam])

  return (
    <PageContainer className="relative py-10 min-h-[70vh]">
      {/* Cinematic Ambient Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[350px] pointer-events-none z-0 opacity-40 md:opacity-60"
        style={{
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(229, 9, 20, 0.08) 0%, rgba(0, 0, 0, 0) 100%)'
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <h1 className="font-display text-4xl font-black tracking-tight text-white">
          {langText.title}
        </h1>
        <p className="mt-2 text-mz-secondary font-medium">
          {langText.subtitle}
        </p>

        {/* Premium Glassmorphic Search Bar */}
        <div className="mt-8 max-w-3xl">
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="relative flex items-center gap-3.5 rounded-2xl border border-white/10 bg-white/5 max-md:bg-zinc-900/90 px-5 py-4 backdrop-blur-md max-md:backdrop-blur-none transition-all duration-300 focus-within:border-mz-primary/60 focus-within:bg-white/[0.08] focus-within:shadow-[0_0_25px_rgba(229,9,20,0.15)]">
              <Search className="h-5 w-5 text-mz-secondary shrink-0" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={langText.placeholder}
                className="w-full bg-transparent text-base text-white placeholder:text-mz-secondary/60 outline-none border-none"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('')
                    setSearchParams({}, { replace: true })
                  }}
                  className="rounded-full p-1 text-mz-secondary hover:bg-white/10 hover:text-white transition duration-200"
                  title="Clear search"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Popular / Trending Suggestions */}
        {query.trim().length < 2 && !loading && !error && (
          <div className="mt-10">
            <div className="flex items-center gap-2">
              <Flame className="h-4.5 w-4.5 text-mz-primary animate-pulse" />
              <p className="text-sm font-bold tracking-wide uppercase text-mz-primary">
                {langText.popularLabel}
              </p>
            </div>

            {suggestionsLoading ? (
              <div className="mt-3 flex flex-wrap gap-2 animate-pulse">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-9 w-24 rounded-full bg-white/5 border border-white/5 shimmer"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2.5">
                {suggestions.map((title) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => {
                      setQuery(title)
                      setSearchParams({ q: title })
                    }}
                    className="rounded-full border border-white/8 bg-white/5 px-4 py-2 text-sm text-mz-secondary transition duration-200 hover:border-mz-primary/40 hover:bg-mz-primary/5 hover:text-white hover:scale-[1.03] active:scale-[0.97] hover:shadow-[0_0_12px_rgba(229,9,20,0.12)] cursor-pointer"
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mt-10 max-w-3xl rounded-2xl border border-mz-error/30 bg-mz-error/10 max-md:bg-zinc-950 p-5 text-mz-error flex items-start gap-3.5 backdrop-blur-md max-md:backdrop-blur-none">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">Search Error</p>
              <p className="mt-1 text-sm opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* Loading Shimmers */}
        {loading && (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, n) => (
              <Shimmer key={n} className="aspect-[2/3] w-full rounded-2xl" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && query.length >= 2 && results.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-white/5 max-md:bg-zinc-900/95 border border-white/5 max-w-md mx-auto backdrop-blur-md max-md:backdrop-blur-none">
            <AlertCircle className="h-9 w-9 text-mz-secondary/40 mb-3" />
            <p className="font-semibold text-white text-base">No matches found</p>
            <p className="mt-2 text-sm text-mz-secondary leading-relaxed">
              We couldn't find any results for &quot;{query}&quot; in the database. Double-check your spelling or toggle content language hubs.
            </p>
          </div>
        )}

        {/* Search Results */}
        {!loading && !error && results.length > 0 && (
          <>
            <div className="mt-10 flex items-center justify-between border-b border-white/5 pb-4">
              <h2 className="text-lg font-bold tracking-tight text-white">Search Results</h2>
              <span className="text-xs font-semibold text-mz-secondary uppercase tracking-wider bg-white/5 border border-white/5 px-3 py-1 rounded-full">
                {results.length} {langText.resultsCount}
              </span>
            </div>
            
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {results.map((result) => (
                <PosterCard key={`${result.provider}-${result.id}`} result={result} />
              ))}
            </div>
          </>
        )}

        {/* Pre-search Hint */}
        {query.length < 2 && !loading && !error && (
          <p className="mt-12 text-sm text-mz-secondary/80">
            {langText.emptyText}
          </p>
        )}
      </div>
    </PageContainer>
  )
}
