import { create } from 'zustand'
import type { V2Details, V2SearchResult } from '@/types/v2'
import { getTmdbList } from '@/services/api'

export interface HomeCatalogData {
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

export interface MoviesCatalogData {
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

export interface TvCatalogData {
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

interface CacheEntry<T> {
  data: T
  lastUpdated: number
}

interface CatalogState {
  // Page-level caches
  homeCatalog: CacheEntry<HomeCatalogData> | null
  moviesCatalog: CacheEntry<MoviesCatalogData> | null
  tvCatalog: CacheEntry<TvCatalogData> | null

  // Detail Page caches
  detailsCaches: Record<string, CacheEntry<V2Details>>
  
  // Loading & error states
  loading: Record<string, boolean>
  errors: Record<string, string | null>

  // Search query & results state
  searchQuery: string
  searchResults: V2SearchResult[]

  // In-flight fetch promises to prevent duplicate requests
  inFlightPromises: Record<string, Promise<any> | undefined>

  // Actions
  fetchHomeCatalog: (staleTime?: number) => Promise<void>
  fetchMoviesCatalog: (preferredLanguage: string, langCode: string | undefined, staleTime?: number) => Promise<void>
  fetchTvCatalog: (preferredLanguage: string, langCode: string | undefined, staleTime?: number) => Promise<void>
  fetchDetails: (key: string, fetchFn: () => Promise<V2Details | null>, staleTime?: number) => Promise<V2Details | null>
  setSearch: (query: string, results: V2SearchResult[]) => void
  clearCache: () => void
}

const DEFAULT_STALE_TIME = 5 * 60 * 1000 // 5 minutes

export const useCatalogStore = create<CatalogState>()((set, get) => ({
  homeCatalog: null,
  moviesCatalog: null,
  tvCatalog: null,
  detailsCaches: {},
  loading: {},
  errors: {},
  searchQuery: '',
  searchResults: [],
  inFlightPromises: {},

  fetchHomeCatalog: async (staleTime = DEFAULT_STALE_TIME) => {
    const { homeCatalog, inFlightPromises } = get()
    const now = Date.now()

    if (homeCatalog && now - homeCatalog.lastUpdated < staleTime) {
      return
    }

    const key = 'home'
    if (inFlightPromises[key]) {
      return inFlightPromises[key]
    }

    const promise = (async () => {
      if (!homeCatalog) {
        set((state) => ({
          loading: { ...state.loading, [key]: true },
          errors: { ...state.errors, [key]: null },
        }))
      }

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
          getTmdbList('discover', { with_origin_country: 'IN' }),
        ])

        const nextHero = heroData.slice(0, 5)
        const nextCatalog: HomeCatalogData = {
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

        set({
          homeCatalog: { data: nextCatalog, lastUpdated: Date.now() },
        })
      } catch (err) {
        console.error('[CatalogStore] Failed to fetch home catalog:', err)
        if (!homeCatalog) {
          set((state) => ({
            errors: {
              ...state.errors,
              [key]: 'Could not load browse catalog. Please check your connection.',
            },
          }))
        }
      } finally {
        set((state) => {
          const nextInFlight = { ...state.inFlightPromises }
          delete nextInFlight[key]
          return {
            loading: { ...state.loading, [key]: false },
            inFlightPromises: nextInFlight,
          }
        })
      }
    })()

    set((state) => ({
      inFlightPromises: { ...state.inFlightPromises, [key]: promise },
    }))

    return promise
  },

  fetchMoviesCatalog: async (preferredLanguage, langCode, staleTime = DEFAULT_STALE_TIME) => {
    const { moviesCatalog, inFlightPromises } = get()
    const now = Date.now()

    const cacheHit = moviesCatalog && moviesCatalog.data.language === preferredLanguage
    if (cacheHit && now - moviesCatalog.lastUpdated < staleTime) {
      return
    }

    const key = `movies_${preferredLanguage}`
    if (inFlightPromises[key]) {
      return inFlightPromises[key]
    }

    const promise = (async () => {
      if (!cacheHit) {
        set((state) => ({
          loading: { ...state.loading, movies: true },
          errors: { ...state.errors, movies: null },
        }))
      }

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
        const nextCatalog: MoviesCatalogData = {
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

        set({
          moviesCatalog: { data: nextCatalog, lastUpdated: Date.now() },
        })
      } catch (err) {
        console.error('[CatalogStore] Failed to fetch movies catalog:', err)
        if (!cacheHit) {
          set((state) => ({
            errors: {
              ...state.errors,
              movies: 'Could not load movies catalog. Please try again.',
            },
          }))
        }
      } finally {
        set((state) => {
          const nextInFlight = { ...state.inFlightPromises }
          delete nextInFlight[key]
          return {
            loading: { ...state.loading, movies: false },
            inFlightPromises: nextInFlight,
          }
        })
      }
    })()

    set((state) => ({
      inFlightPromises: { ...state.inFlightPromises, [key]: promise },
    }))

    return promise
  },

  fetchTvCatalog: async (preferredLanguage, langCode, staleTime = DEFAULT_STALE_TIME) => {
    const { tvCatalog, inFlightPromises } = get()
    const now = Date.now()

    const cacheHit = tvCatalog && tvCatalog.data.language === preferredLanguage
    if (cacheHit && now - tvCatalog.lastUpdated < staleTime) {
      return
    }

    const key = `tv_${preferredLanguage}`
    if (inFlightPromises[key]) {
      return inFlightPromises[key]
    }

    const promise = (async () => {
      if (!cacheHit) {
        set((state) => ({
          loading: { ...state.loading, tv: true },
          errors: { ...state.errors, tv: null },
        }))
      }

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
        const nextCatalog: TvCatalogData = {
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

        set({
          tvCatalog: { data: nextCatalog, lastUpdated: Date.now() },
        })
      } catch (err) {
        console.error('[CatalogStore] Failed to fetch TV catalog:', err)
        if (!cacheHit) {
          set((state) => ({
            errors: {
              ...state.errors,
              tv: 'Could not load TV series catalog. Please try again.',
            },
          }))
        }
      } finally {
        set((state) => {
          const nextInFlight = { ...state.inFlightPromises }
          delete nextInFlight[key]
          return {
            loading: { ...state.loading, tv: false },
            inFlightPromises: nextInFlight,
          }
        })
      }
    })()

    set((state) => ({
      inFlightPromises: { ...state.inFlightPromises, [key]: promise },
    }))

    return promise
  },

  fetchDetails: async (key, fetchFn, staleTime = DEFAULT_STALE_TIME) => {
    const { detailsCaches, inFlightPromises } = get()
    const cached = detailsCaches[key]
    const now = Date.now()

    if (cached && now - cached.lastUpdated < staleTime) {
      return cached.data
    }

    if (inFlightPromises[key]) {
      return inFlightPromises[key]
    }

    const promise = (async () => {
      if (!cached) {
        set((state) => ({
          loading: { ...state.loading, [key]: true },
          errors: { ...state.errors, [key]: null },
        }))
      }

      try {
        const data = await fetchFn()
        if (data) {
          set((state) => ({
            detailsCaches: {
              ...state.detailsCaches,
              [key]: { data, lastUpdated: Date.now() },
            },
          }))
          return data
        }
        return cached?.data ?? null
      } catch (err) {
        console.error(`[CatalogStore] Failed to fetch details for key ${key}:`, err)
        if (!cached) {
          set((state) => ({
            errors: {
              ...state.errors,
              [key]: err instanceof Error ? err.message : 'Failed to fetch details',
            },
          }))
        }
        return cached?.data ?? null
      } finally {
        set((state) => {
          const nextPromises = { ...state.inFlightPromises }
          delete nextPromises[key]
          return {
            loading: { ...state.loading, [key]: false },
            inFlightPromises: nextPromises,
          }
        })
      }
    })()

    set((state) => ({
      inFlightPromises: { ...state.inFlightPromises, [key]: promise },
    }))

    return promise
  },

  setSearch: (query, results) => {
    set({ searchQuery: query, searchResults: results })
  },

  clearCache: () => {
    set({ homeCatalog: null, moviesCatalog: null, tvCatalog: null, detailsCaches: {}, loading: {}, errors: {}, searchQuery: '', searchResults: [] })
  },
}))
