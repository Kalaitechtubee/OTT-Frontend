export const paths = {
  boot: '/boot',
  home: '/',
  movies: '/movies',
  tvSeries: '/tv-series',
  search: '/search',
  library: '/library',
  account: '/account',
  language: '/preferences/language',
  languageHub: (lang: string) =>
    `/language/${encodeURIComponent(lang.toLowerCase())}`,
  languageCategory: (lang: string, category: string) =>
    `/language/${encodeURIComponent(lang.toLowerCase())}/${category}`,
  /** V2: detail page uses provider + provider-id and optional metadata hints */
  detail: (
    provider: string,
    id: string,
    meta?: {
      title?: string
      year?: string | number | null
      sources?: { provider: string; id: string }[]
    },
  ) => {
    const query = new URLSearchParams()
    if (meta?.title) query.set('title', meta.title)
    if (meta?.year != null && String(meta.year).trim()) query.set('year', String(meta.year))
    if (meta?.sources && meta.sources.length > 0) {
      const srcStr = meta.sources.map((s) => `${s.provider}:${s.id}`).join(',')
      query.set('sources', srcStr)
    }
    const queryString = query.toString()
    return `/title/${provider}/${id}${queryString ? `?${queryString}` : ''}`
  },
  /** V2: detail page by TMDB ID directly */
  tmdbDetail: (
    tmdbId: string,
    meta?: {
      title?: string
      year?: string | number | null
      type?: string
    },
  ) => {
    const query = new URLSearchParams()
    if (meta?.title) query.set('title', meta.title)
    if (meta?.year != null && String(meta.year).trim()) query.set('year', String(meta.year))
    if (meta?.type) query.set('type', meta.type)
    const queryString = query.toString()
    return `/title/tmdb/${tmdbId}${queryString ? `?${queryString}` : ''}`
  },
  /** V2: watch page uses provider + provider-id */
  watch: (provider: string, id: string) => `/play/${provider}/${id}`,
} as const
