// ─── V2 API Types ─────────────────────────────────────────────────────────────

export type Provider = 'net11' | 'net52' | 'tmdb' | 'netmirror' | 'peachify' | string

export interface V2SearchResult {
  id: string
  title: string
  year: string
  provider: Provider
  tmdbId: number | null
  imdbId?: string | null
  mediaType: 'movie' | 'tv'
  poster: string | null
  backdrop: string | null
  rating: string | null
  sources?: { provider: Provider; id: string }[]
}

export interface V2CastMember {
  name: string
  character: string
  profilePath: string | null
}

export interface V2Recommendation {
  id: number
  title: string
  posterPath: string | null
  mediaType: 'movie' | 'tv'
}

export interface V2Language {
  l: string
  s: string
}

export interface V2Details {
  id: string
  provider: Provider
  title: string
  year: string
  description: string
  director: string
  genre: string
  languages: V2Language[]
  cast: V2CastMember[]
  poster: string | null
  backdrop: string | null
  rating: string | null
  trailer: string | null
  recommendations: V2Recommendation[]
  tmdbId: number | null
  imdbId?: string | null
  mediaType: 'movie' | 'tv'
  sources?: {
    provider: Provider
    id: string
    languages?: string[]
    label?: string
    streamType?: string
    /** True = backend confirmed this provider has a working stream */
    available?: boolean
    /** 1-based position in the backend priority list (Server 1, Server 2...) */
    serverIndex?: number
    /** Optional pre-resolved embed URL for embed-type providers */
    embedUrl?: string | null
    downloadSupported?: boolean
    variants?: { id: string; language: string }[]
  }[]
  audioLanguages?: string[]
  duration?: number | null
  seasons?: {
    season_number: number
    episode_count: number
    name: string
    providerSeasonId?: string
  }[]
  /**
   * The backend's chosen highest-priority available provider.
   * Frontend uses this for auto-play routing without selecting a provider itself.
   * Set by the sequential pipeline in checkAvailability().
   */
  defaultProvider?: string | null
}


export interface V2Stream {
  quality: string
  label?: string
  default?: boolean
  url: string
}

export interface V2Subtitle {
  kind: string
  label: string
  language: string
  url: string
}

export interface V2StreamResult {
  success: boolean
  /** Provider that actually served this stream (set by backend pipeline) */
  provider?: string
  /** The provider selected by the backend pipeline (same as provider) */
  selectedProvider?: string
  /** True if the pipeline fell back from Provider 1 to a subsequent provider */
  fallbackTriggered?: boolean
  available?: boolean
  subjectId?: string
  title?: string
  poster?: string | null
  thumbnails?: string | null
  streams: V2Stream[]
  subtitles: V2Subtitle[]
  /** Set when the stream is an iframe embed (e.g. Peachify / vidsrc fallback) */
  streamType?: 'embed' | 'hls' | 'mp4' | 'native'
  embedUrl?: string
  /** Ordered list of fallback embed URLs to try if the primary embedUrl fails */
  embedFallbacks?: string[]
  variants?: { id: string; language: string }[]
  selectedVariantId?: string | null
  stream?: {
    variants?: { id: string; language: string }[]
    embedFallbacks?: string[]
    audioTracks?: { id: string; name: string; language: string; default?: boolean }[]
    subtitleTracks?: { id: string; name: string; language: string; default?: boolean }[]
  }
}


/** Parse a V2 rating string like "TMDB 7.5" into a number (7.5) */
export function parseV2Rating(raw: string | null | undefined): number {
  if (!raw) return 0
  const match = raw.match(/[\d.]+/)
  if (!match) return 0
  return parseFloat(match[0]) || 0
}

/** Parse a V2 quality string like "720p" into a resolution number */
export function parseV2Quality(quality: string): number {
  const match = quality.match(/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

/** Extract YouTube video key from a full YouTube URL */
export function parseYoutubeKey(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    // https://www.youtube.com/watch?v=KEY
    const v = parsed.searchParams.get('v')
    if (v) return v
    // https://youtu.be/KEY
    if (parsed.hostname === 'youtu.be') return parsed.pathname.slice(1) || null
  } catch {
    // not a valid URL
  }
  return null
}
