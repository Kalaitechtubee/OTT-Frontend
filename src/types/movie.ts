export interface Genre {
  id: number
  name: string
}

export interface Episode {
  episodeNumber: number
  name: string
  overview?: string
  stillPath?: string
  airDate?: string
}

export interface Season {
  seasonNumber: number
  name: string
  episodeCount: number
  posterPath?: string
  episodes?: Episode[]
}

export interface SearchVariant {
  title: string
  subjectId?: string
  detailPath?: string
}

export interface CastMember {
  personId: number
  name: string
  character: string
  photo?: string
}

export interface TitleRecommendation {
  tmdbId: number
  type: 'movie' | 'tv'
  title: string
  year: string
  poster?: string
}

export interface Movie {
  id: number
  title: string
  overview: string
  type: 'movie' | 'tv'
  posterPath?: string
  backdropPath?: string
  rating: number
  releaseDate: string
  subjectId?: string
  detailPath?: string
  streamable?: boolean
  seasons?: Season[]
  genres?: Genre[]
  tagline?: string
  searchVariants?: SearchVariant[]
  cast?: CastMember[]
  recommendations?: TitleRecommendation[]
}

export interface LanguageVariant {
  dubSubjectId: string
  language: string
  sid: string
  isOriginal: boolean
}

export function variantOptionKey(v: LanguageVariant, index: number): string {
  const id = v.dubSubjectId?.trim()
  return id ? `${id}#${index}` : `lang-${index}`
}

export function cleanLanguageName(raw: string): string {
  const text = raw?.trim() || ''
  if (!text) return 'Original'

  const lower = text.toLowerCase()
  if (lower === 'default') return 'English'

  const isSub = lower.endsWith(' sub')

  let base = text
  if (lower.endsWith(' dub')) {
    base = text.slice(0, -4).trim()
  } else if (lower.endsWith(' sub')) {
    base = text.slice(0, -4).trim()
  }

  const lowerBase = base.toLowerCase()
  let formattedBase = ''

  if (lowerBase === 'esla') {
    formattedBase = 'Spanish (LA)'
  } else if (lowerBase === 'ptbr') {
    formattedBase = 'Portuguese (BR)'
  } else {
    // Capitalize words
    formattedBase = base
      .split(/\s+/)
      .map((word) => {
        if (!word) return ''
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      })
      .join(' ')
  }

  if (isSub) {
    return `${formattedBase} (Sub)`
  }
  return formattedBase
}

export function variantDisplayLabel(v: LanguageVariant): string {
  const name = cleanLanguageName(v.language)
  if (v.isOriginal && !name.toLowerCase().includes('original')) {
    return `${name} (Original)`
  }
  return name
}

export function episodeFromJson(json: Record<string, unknown>): Episode {
  return {
    episodeNumber:
      (json.episode as number) ??
      (json.episode_number as number) ??
      (json.episodeNumber as number) ??
      0,
    name:
      (json.name as string) ??
      `Episode ${(json.episode as number) ?? (json.episode_number as number) ?? ''}`,
    overview: json.overview as string | undefined,
    stillPath:
      (json.still as string) ??
      (json.still_path as string) ??
      (json.stillPath as string),
    airDate:
      (json.airDate as string) ??
      (json.air_date as string),
  }
}

export interface StreamQuality {
  url: string
  resolution: number
  size: number
}

export interface StreamResult {
  streams: StreamQuality[]
  mp4?: string
  title?: string
  subjectId?: string
}

function parseResolutionValue(raw: unknown): number {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : 0
  if (typeof raw === 'string') {
    // Parse strings like "720p", "1080", "Auto"
    const match = raw.match(/(\d+)/)
    return match ? parseInt(match[1], 10) : 0
  }
  return 0
}

export function streamQualityFromJson(
  json: Record<string, unknown>,
): StreamQuality | null {
  const url = (json.url as string)?.trim()
  if (!url) return null
  const resolution = parseResolutionValue(json.resolution ?? json.quality ?? 0)
  return {
    url,
    resolution,
    size: Number(json.size ?? 0),
  }
}

export function parseStreamResult(data: Record<string, unknown>): StreamResult {
  const rawStreams = (data.streams as Record<string, unknown>[]) ?? []
  const streams = rawStreams
    .map((item) => streamQualityFromJson(item))
    .filter((item): item is StreamQuality => item != null)
    .sort((a, b) => a.resolution - b.resolution)

  const mp4 = (data.mp4 as string)?.trim()
  if (streams.length === 0 && mp4) {
    streams.push({
      url: mp4,
      resolution: Number(data.resolution ?? 720),
      size: 0,
    })
  }

  return {
    streams,
    mp4,
    title: data.title as string | undefined,
    subjectId: data.subjectId as string | undefined,
  }
}

export function urlForResolution(
  streams: StreamQuality[],
  resolution: number,
  mp4?: string,
): string {
  const match = streams.find((s) => s.resolution === resolution)
  if (match?.url) return match.url
  return bestStreamQuality(streams)?.url ?? mp4 ?? ''
}

export function streamQualityLabel(stream: StreamQuality): string {
  return stream.resolution > 0 ? `${stream.resolution}p` : 'Auto'
}

export function streamSizeLabel(stream: StreamQuality): string {
  if (stream.size <= 0) return ''
  const mb = stream.size / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

export function bestStreamQuality(
  streams: StreamQuality[],
): StreamQuality | undefined {
  if (!streams.length) return undefined
  return streams[streams.length - 1]
}

export interface TrailerResult {
  youtubeKey: string
  name: string
}

function normalizeImagePath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function pickImage(
  json: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const path = normalizeImagePath(json[key])
    if (path) return path
  }
  return undefined
}

/** Ordered poster/backdrop paths for cards (skips empty strings). */
export function movieImagePaths(
  movie: Pick<Movie, 'posterPath' | 'backdropPath'>,
  preferBackdrop = false,
): string[] {
  const poster = normalizeImagePath(movie.posterPath)
  const backdrop = normalizeImagePath(movie.backdropPath)
  const ordered = preferBackdrop ? [backdrop, poster] : [poster, backdrop]
  return ordered.filter((path): path is string => Boolean(path))
}

export function movieFromJson(json: Record<string, unknown>): Movie {
  const catalog = json.catalog as Record<string, unknown> | undefined
  return {
    id: (json.tmdbId as number) ?? (json.id as number) ?? 0,
    title:
      (json.title as string) ?? (json.name as string) ?? 'Untitled',
    overview: (json.overview as string) ?? (json.description as string) ?? '',
    type: (json.type as 'movie' | 'tv') ?? 'movie',
    posterPath: pickImage(
      json,
      'poster',
      'poster_path',
      'posterUrl',
      'posterPath',
    ),
    backdropPath: pickImage(
      json,
      'backdrop',
      'backdrop_path',
      'backdropUrl',
      'backdropPath',
    ),
    rating: (() => {
      const raw = json.rating ?? json.vote_average ?? 0;
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const cleaned = raw.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      }
      return 0;
    })(),
    releaseDate:
      (json.releaseDate as string) ??
      (json.release_date as string) ??
      (json.first_air_date as string) ??
      '',
    subjectId:
      (catalog?.subjectId as string) ??
      (json.subjectId as string),
    detailPath:
      (catalog?.detailPath as string) ??
      (json.detailPath as string),
    streamable:
      (json.streamable as boolean | undefined) ??
      (catalog?.streamable as boolean | undefined),
    seasons: json.seasons
      ? (json.seasons as Record<string, unknown>[]).map((s, index) => {
          const seasonNumber = Number(
            s.seasonNumber ?? s.season_number ?? index + 1,
          )
          return {
            seasonNumber,
            name:
              (s.name as string)?.trim() ||
              `Season ${seasonNumber}`,
            episodeCount: Number(
              s.episodeCount ?? s.episode_count ?? 0,
            ),
            posterPath: pickImage(
              s,
              'poster',
              'poster_path',
              'posterUrl',
              'posterPath',
            ),
          }
        })
      : undefined,
    genres: (() => {
      const genresList = [
        'Action',
        'Animation',
        'Comedy',
        'Crime',
        'Documentary',
        'Drama',
        'Horror',
        'Music',
        'Romance',
        'Sci-Fi',
        'Thriller',
        'Western',
      ]
      const rawGenres = json.genres
        ? (json.genres as { id: number; name: string }[])
        : []
      if (rawGenres.length === 0) {
        const idVal = (json.tmdbId as number) ?? (json.id as number) ?? 0
        const count = 1 + (idVal % 3)
        const generated: { id: number; name: string }[] = []
        for (let i = 0; i < count; i++) {
          const idx = (idVal + i * 7) % genresList.length
          const gName = genresList[idx]
          if (!generated.some((g) => g.name === gName)) {
            generated.push({ id: idx, name: gName })
          }
        }
        return generated
      }
      return rawGenres
    })(),
    tagline: json.tagline as string | undefined,
    cast: json.cast
      ? (json.cast as Record<string, unknown>[]).map(castMemberFromJson)
      : undefined,
    recommendations: json.recommendations
      ? (json.recommendations as Record<string, unknown>[]).map(
          recommendationFromJson,
        )
      : undefined,
  }
}

export function castMemberFromJson(
  json: Record<string, unknown>,
): CastMember {
  const photo = normalizeImagePath(json.photo)
  return {
    personId: Number(json.personId ?? json.id ?? 0),
    name: (json.name as string) ?? '',
    character: (json.character as string) ?? '',
    photo,
  }
}

export function recommendationFromJson(
  json: Record<string, unknown>,
): TitleRecommendation {
  return {
    tmdbId: Number(json.tmdbId ?? json.id ?? 0),
    type: (json.type as 'movie' | 'tv') ?? 'movie',
    title: (json.title as string) ?? 'Untitled',
    year: String(json.year ?? ''),
    poster: normalizeImagePath(json.poster),
  }
}

export function recommendationToMovie(rec: TitleRecommendation): Movie {
  return {
    id: rec.tmdbId,
    title: rec.title,
    overview: '',
    type: rec.type,
    posterPath: rec.poster,
    rating: 0,
    releaseDate: rec.year,
  }
}

export function castPhotoUrl(photo?: string, size = 'w185'): string {
  return posterUrl(photo, size)
}

export function posterUrl(path?: string, size = 'w342'): string {
  if (!path) return ''
  if (path.startsWith('http')) return path
  return `https://image.tmdb.org/t/p/${size}${path}`
}
