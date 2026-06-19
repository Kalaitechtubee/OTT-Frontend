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
  sources?: { provider: Provider; id: string; languages?: string[]; label?: string; streamType?: string }[]
  audioLanguages?: string[]
  seasons?: {
    season_number: number
    episode_count: number
    name: string
    providerSeasonId?: string
  }[]
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
  provider?: string
  subjectId?: string
  title?: string
  poster?: string | null
  thumbnails?: string | null
  streams: V2Stream[]
  subtitles: V2Subtitle[]
  /** Set when the stream is an iframe embed (e.g. Peachify Server 2) */
  streamType?: 'embed' | 'hls' | 'mp4'
  embedUrl?: string
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
