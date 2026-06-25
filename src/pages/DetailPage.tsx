import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { ChevronLeft, Film, Star, Play, HelpCircle } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { FeedbackBanner } from '@/components/common/FeedbackBanner'
import { CastSection } from '@/components/detail/CastSection'
import { RecommendationsSection } from '@/components/detail/RecommendationsSection'

import {
  StreamQualityModal,
  type StreamQualityMode,
} from '@/components/detail/StreamQualityModal'
import { TrailerModal } from '@/components/detail/TrailerModal'
import { Shimmer } from '@/components/common/Shimmer'
import { ErrorState } from '@/components/common/ErrorState'
import {
  getDetailsV2,
  getDetailsByTmdbId,
  getSeasonEpisodesV2,
} from '@/services/api'

import { useDownload } from '@/hooks/useDownload'
import { DownloadButton } from '@/components/Download/DownloadButton'
import { DownloadModal } from '@/components/Download/DownloadModal'
import { DownloadProgress } from '@/components/Download/DownloadProgress'

import { useDownloadStore } from '@/store/downloadStore'
import { usePlayerStore } from '@/store/playerStore'
import { useCatalogStore } from '@/store/catalogStore'
import { paths } from '@/routes/paths'
import type { Provider, V2Details, V2Stream, V2Subtitle } from '@/types/v2'
import { parseV2Rating, parseV2Quality, parseYoutubeKey } from '@/types/v2'

interface LanguageVariant {
  dubSubjectId: string
  language: string
  isOriginal: boolean
}

function getAvailableLanguages(details: V2Details | null): LanguageVariant[] {
  if (!details) return []
  const list: LanguageVariant[] = []
  const sources = details.sources || []

  if (sources.length > 0) {
    for (const src of sources) {
      if (src.variants && src.variants.length > 0) {
        for (const variant of src.variants) {
          list.push({
            dubSubjectId: variant.id,
            language: variant.language,
            isOriginal:
              variant.id === details.id ||
              variant.language.toLowerCase().includes('original') ||
              variant.language.toLowerCase().includes('multi'),
          })
        }
      } else if (src.languages && src.languages.length > 0) {
        for (const lang of src.languages) {
          list.push({
            dubSubjectId: src.id,
            language: lang,
            isOriginal:
              src.id === details.id ||
              lang.toLowerCase().includes('original') ||
              lang.toLowerCase().includes('multi'),
          })
        }
      }
    }
  }

  if (list.length > 0) {
    return list
  }

  if (details.audioLanguages && details.audioLanguages.length > 0) {
    return details.audioLanguages.map((lang) => ({
      dubSubjectId: '',
      language: lang,
      isOriginal:
        lang.toLowerCase().includes('original') ||
        lang.toLowerCase().includes('multi'),
    }))
  }

  return [
    {
      dubSubjectId: '',
      language: 'Original Audio',
      isOriginal: true,
    },
  ]
}

function resolveSelectedLanguage(
  languages: LanguageVariant[],
  currentSelected: LanguageVariant | null,
): LanguageVariant | null {
  if (languages.length === 0) return null

  // 1. Keep current selection if compatible
  if (currentSelected) {
    const match = languages.find(
      (l) =>
        l.dubSubjectId === currentSelected.dubSubjectId &&
        l.language === currentSelected.language,
    )
    if (match) return match
  }

  // 2. Match global preference by dub ID
  const prefDubId = localStorage.getItem('preferredDubId')
  if (prefDubId) {
    const match = languages.find((l) => l.dubSubjectId === prefDubId)
    if (match) return match
  }

  // 3. Match global preference by language name
  const prefLang = localStorage.getItem('preferredLanguage')
  if (prefLang) {
    const target = prefLang.toLowerCase()
    const match = languages.find((l) => l.language.toLowerCase().includes(target))
    if (match) return match
  }

  // 4. Prefer original
  const original = languages.find((l) => l.isOriginal)
  if (original) return original

  return languages[0]
}

export function DetailPage() {
  const { provider, id, tmdbId } = useParams<{ provider: string; id: string; tmdbId?: string }>()
  const [searchParams] = useSearchParams()
  const titleParam = searchParams.get('title') || undefined
  const yearParam = searchParams.get('year') || undefined
  const sourcesParam = searchParams.get('sources') || undefined

  const navigate = useNavigate()
  const location = useLocation()
  const play = usePlayerStore((s) => s.play)
  const startDownload = useDownloadStore((s) => s.startDownload)
  const dl = useDownload()

  // Synchronous cache lookup for instant detail rendering
  const detailsKey = tmdbId ? `tmdb_${tmdbId}` : `${provider}_${id}`
  const details = useCatalogStore((s) => s.detailsCaches[detailsKey]?.data || null)
  const loading = useCatalogStore((s) => s.loading[detailsKey] || false)
  const fetchDetails = useCatalogStore((s) => s.fetchDetails)

  const playing = false

  // Audio language states
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageVariant | null>(null)

  // Sync available languages when details are loaded
  useEffect(() => {
    if (details) {
      const list = getAvailableLanguages(details)
      setSelectedLanguage((prev) => resolveSelectedLanguage(list, prev))
    } else {
      setSelectedLanguage(null)
    }
  }, [details])

  // Quality modal states
  const [qualityModal, setQualityModal] = useState<{
    mode: StreamQualityMode
    streams: V2Stream[]
    title?: string
    context?: { provider: string; id: string }
    subtitles?: V2Subtitle[]
    variants?: { id: string; language: string }[]
  } | null>(null)

  const [feedback, setFeedback] = useState<string | null>(null)
  const [trailerKey, setTrailerKey] = useState<string | null>(null)

  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [episodes, setEpisodes] = useState<any[]>([])
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)

  // Server status is provided by the backend's checkAvailability() in the details response.
  // We derive it from details.sources — no client-side polling is needed.
  // 'available' = source returned by backend availability check (present in sources array)
  // This eliminates duplicate provider requests and race conditions.


  const isAutomatic = !!tmdbId || provider === 'tmdb'
  const activeProvider = provider || details?.provider
  const activeId = id || details?.id
  const hasStreams = !!(
    (activeProvider && activeId && activeProvider !== 'tmdb') ||
    (details && details.sources && details.sources.length > 0)
  )

  const isDownloadSupported = !!(
    details &&
    details.sources &&
    details.sources.some((s) => s.available && s.downloadSupported)
  )

  // Fetch Details in the background
  useEffect(() => {
    const fetchFn = async () => {
      if (tmdbId) {
        const type = searchParams.get('type') || 'movie'
        return getDetailsByTmdbId(tmdbId, type, titleParam, yearParam)
      } else if (provider && id) {
        return getDetailsV2(provider as Provider, id, titleParam, yearParam, sourcesParam)
      }
      return null
    }

    void fetchDetails(detailsKey, fetchFn)
  }, [detailsKey, provider, id, tmdbId, titleParam, yearParam, sourcesParam, searchParams, fetchDetails])

  // Provider status is derived from the backend's availability response (details.sources).
  // Source indicators are shown directly from details.sources — no client-side polling needed.
  // This eliminates duplicate stream requests and ensures statuses reflect backend priority.

  // Set default selected season when details are loaded
  useEffect(() => {
    if (details?.seasons && details.seasons.length > 0) {
      const firstSeason = details.seasons[0].season_number
      setSelectedSeason(firstSeason)
    }
  }, [details])

  // Fetch Season Episodes
  useEffect(() => {
    if (!details || details.mediaType !== 'tv') return
    let cancelled = false
      ; (async () => {
        setLoadingEpisodes(true)
        try {
          const activeSource = details.sources?.[0]
          const matchedSeason = details.seasons?.find(s => s.season_number === selectedSeason)
          const providerSeasonId = matchedSeason?.providerSeasonId
          const activeProv = activeSource?.provider || activeProvider
          const activeSeriesId = activeSource?.id || activeId

          const eps = await getSeasonEpisodesV2(
            String(details.tmdbId || details.id),
            selectedSeason,
            activeProv,
            activeSeriesId,
            providerSeasonId
          )
          if (cancelled) return
          setEpisodes(eps)
        } catch (err) {
          console.error('Failed to load season episodes:', err)
        } finally {
          if (!cancelled) setLoadingEpisodes(false)
        }
      })()
    return () => {
      cancelled = true
    }
  }, [details, selectedSeason])

  // Play Episode handler (navigates to player instantly; handles background resolution)
  const handlePlayEpisode = (episode: any) => {
    const episodeProvider = episode.provider || activeProvider
    const episodeId = episode.id || activeId
    if (!episodeProvider || !episodeId || !details) {
      setFeedback('Streaming source unavailable for this episode.')
      return
    }

    const episodeTitleFormatted = `${details.title} - S${selectedSeason}E${episode.episode_number} - ${episode.name}`

    // Pass metadata details via query params to show immediate loader themed UI in watcher
    const query = new URLSearchParams()
    query.set('title', episodeTitleFormatted)
    if (details.poster) query.set('poster', details.poster)
    if (episode.overview || details.description) {
      query.set('overview', episode.overview || details.description || '')
    }
    if (details.tmdbId) query.set('tmdbId', String(details.tmdbId))
    query.set('mediaType', 'tv')
    if (details.sources && details.sources.length > 0) {
      const srcStr = details.sources.map((s) => `${s.provider}:${s.id}`).join(',')
      query.set('sources', srcStr)
    }
    if (selectedLanguage?.dubSubjectId && selectedLanguage.dubSubjectId !== String(details.tmdbId) && selectedLanguage.dubSubjectId !== details.id) {
      query.set('dub', selectedLanguage.dubSubjectId)
    }

    navigate(`/play/${episodeProvider}/${episodeId}?${query.toString()}`, {
      state: { backgroundLocation: location },
    })
  }

  // Play Movie / Stream handler
  // For auto-play: routes through /play/tmdb/:tmdbId — the backend resolves which provider.
  // For manual server selection (user taps a specific server badge): routes through /play/:provider/:id.
  const handlePlay = (explicitSource?: { provider: string; id: string }) => {
    if (!details) {
      setFeedback('Streaming sources are currently unavailable for this title.')
      return
    }

    const query = new URLSearchParams()
    query.set('title', details.title)
    if (details.poster) query.set('poster', details.poster)
    if (details.description) query.set('overview', details.description)
    if (details.tmdbId) query.set('tmdbId', String(details.tmdbId))
    if (details.mediaType) query.set('mediaType', details.mediaType)
    if (details.sources && details.sources.length > 0) {
      const srcStr = details.sources.map((s) => `${s.provider}:${s.id}`).join(',')
      query.set('sources', srcStr)
    }
    if (selectedLanguage?.dubSubjectId && selectedLanguage.dubSubjectId !== String(details.tmdbId) && selectedLanguage.dubSubjectId !== details.id) {
      query.set('dub', selectedLanguage.dubSubjectId)
    }

    if (explicitSource) {
      // User explicitly selected a server — route directly to that provider
      navigate(`/play/${explicitSource.provider}/${explicitSource.id}?${query.toString()}`, {
        state: { backgroundLocation: location },
      })
    } else {
      // Auto-play: let the backend pipeline decide the provider.
      // Navigate to /play/tmdb/:tmdbId — PlayerPage calls resolveStream() which runs the pipeline.
      const tmdbTarget = details.tmdbId || details.id
      if (!tmdbTarget) {
        setFeedback('Streaming sources are currently unavailable for this title.')
        return
      }
      navigate(`/play/tmdb/${tmdbTarget}?${query.toString()}`, {
        state: { backgroundLocation: location },
      })
    }
  }


  // Directly trigger download modal using the custom useDownload hook.
  // ARCHITECTURE RULE: Provider selection for downloads is the backend's responsibility.
  // The custom hook fetches streams via resolveDownload, which runs the backend pipeline.
  const handleDownloadClick = () => {
    if (!details) {
      setFeedback('Streaming sources are currently unavailable for this title.')
      return
    }
    const tmdbTarget = String(details.tmdbId || details.id)
    if (!tmdbTarget) {
      setFeedback('Streaming sources are currently unavailable for this title.')
      return
    }

    // Determine variant ID from selected language if available
    const variantId = selectedLanguage?.dubSubjectId && selectedLanguage.dubSubjectId !== ''
      ? selectedLanguage.dubSubjectId
      : undefined

    const downloadSources = details.sources?.filter(s => s.available && s.downloadSupported) || []

    dl.openDownload(
      tmdbTarget,
      (details.mediaType as 'movie' | 'tv') || 'movie',
      {
        title: details.title,
        poster: details.poster,
        year: details.year,
        runtime: details.duration
      },
      undefined,
      undefined,
      variantId,
      downloadSources
    )
  }

  // On selecting a quality inside StreamQualityModal
  const handleQualitySelect = async (stream: V2Stream) => {
    if (!details || !activeProvider || !activeId || !qualityModal) return
    const mode = qualityModal.mode
    const targetTitle = (qualityModal as any).title || details.title
    const targetContext = (qualityModal as any).context || { provider: activeProvider, id: activeId }
    const targetSubtitles = (qualityModal as any).subtitles || []
    setQualityModal(null)

    if (mode === 'play') {
      play(
        targetTitle,
        details.poster,
        targetContext,
        stream.url,
        qualityModal.streams,
        stream.quality,
        targetSubtitles,
        String(details.tmdbId || details.id),
        details.mediaType,
        details.description,
        null,
        null,
        (qualityModal as any).variants,
        targetContext.id
      )
      navigate(paths.watch(targetContext.provider, targetContext.id))
      return
    }

    const isOffline = mode === 'download_offline'
    const resolution = parseV2Quality(stream.quality)

    // ARCHITECTURE RULE: targetContext is already resolved by the backend download pipeline.
    // No provider-selection logic here — the backend already chose the correct provider.
    const downloadProvider = targetContext.provider
    const downloadId = targetContext.id

    setFeedback('Starting download...')
    const ok = await startDownload({
      tmdbId: details.tmdbId ?? 0,
      title: details.title,
      type: details.mediaType,
      posterPath: details.poster ?? undefined,
      resolution,
      quality: stream.quality,
      language: selectedLanguage?.language ?? 'Original',
      isOffline,
      provider: downloadProvider,
      id: downloadId,
      dub: (selectedLanguage?.dubSubjectId && selectedLanguage.dubSubjectId !== String(details.tmdbId) && selectedLanguage.dubSubjectId !== details.id) ? selectedLanguage.dubSubjectId : undefined,
    })

    if (ok) {
      setFeedback(
        isOffline
          ? `Offline download started for "${details.title}" (${stream.quality}). View progress in My List → Downloads.`
          : `Download started for "${details.title}" (${stream.quality}). Check your browser downloads folder.`,
      )
    } else {
      setFeedback('Download failed. Please try again.')
    }
  }

  // Trailer handler
  const handleTrailer = () => {
    if (!details?.trailer) {
      setFeedback('Trailer not available for this title.')
      return
    }
    const key = parseYoutubeKey(details.trailer)
    if (!key) {
      setFeedback('Trailer link could not be parsed.')
      return
    }
    setTrailerKey(key)
  }

  if (loading && !details) {
    return (
      <div className="min-h-dvh bg-mz-background">
        <PageContainer className="py-10">
          <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
            <Shimmer className="aspect-[2/3] w-full max-w-[280px] rounded-xl" />
            <div className="space-y-4">
              <Shimmer className="h-10 w-2/3" />
              <Shimmer className="h-4 w-full" />
              <Shimmer className="h-4 w-5/6" />
            </div>
          </div>
        </PageContainer>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="min-h-dvh bg-mz-background">
        <PageContainer className="py-16">
          <ErrorState onRetry={() => window.location.reload()} />
        </PageContainer>
      </div>
    )
  }

  const rating = parseV2Rating(details.rating)
  const isTv = details.mediaType === 'tv'

  return (
    <div className="min-h-dvh bg-mz-background pb-12">

      {details.backdrop && (
        <div className="relative h-[45vh] w-full overflow-hidden sm:h-[50vh] md:h-[60vh] lg:h-[65vh] bg-black select-none pointer-events-none">
          <img
            src={details.backdrop}
            alt=""
            className="h-full w-full object-cover opacity-60 transition-transform duration-1000 scale-[1.01]"
          />
          {/* Cinematic Overlay Gradients */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.85)_100%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-mz-background via-mz-background/45 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-mz-background/75 to-transparent" />
        </div>
      )}

      <PageContainer className={`relative py-8 ${details.backdrop ? '-mt-32 sm:-mt-44 md:-mt-52 lg:-mt-60 z-20' : 'pt-4'}`}>
        <Link
          to={paths.home}
          className="mb-6 inline-flex items-center gap-1 text-sm text-mz-secondary hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to browse
        </Link>

        {feedback && (
          <FeedbackBanner
            message={feedback}
            tone={feedback.toLowerCase().includes('failed') ? 'error' : 'success'}
            onDismiss={() => setFeedback(null)}
          />
        )}

        <div className="grid gap-8 lg:grid-cols-[minmax(220px,320px)_1fr]">
          {/* Left Column: Poster */}
          <div className="mx-auto w-full max-w-[320px] lg:mx-0">
            {details.poster ? (
              <div className="relative group rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.85)] border border-white/10 transition-transform duration-500 hover:scale-[1.03]">
                <img
                  src={details.poster}
                  alt={details.title}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            ) : (
              <div className="aspect-[2/3] rounded-2xl bg-mz-card flex items-center justify-center text-mz-secondary border border-white/5 shadow-2xl">
                No Poster
              </div>
            )}
            <p className="mt-4.5 text-center text-xs font-bold uppercase tracking-widest text-mz-primary/80 lg:text-left">
              Catalog: V2 {details.provider}
            </p>
          </div>

          {/* Right Column: Information & Actions */}
          <div className="flex flex-col select-text">
            <h1 className="font-display text-3xl font-extrabold lg:text-5xl tracking-tight text-white leading-tight drop-shadow-md">
              {details.title}
            </h1>

            <div className="mt-4.5 flex flex-wrap items-center gap-3 text-sm text-mz-secondary">
              {rating > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/35 bg-yellow-500/10 px-3 py-0.5 text-xs font-extrabold text-yellow-400 backdrop-blur-md shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-yellow-400" />
                  TMDB {rating.toFixed(1)}
                </span>
              )}

              <span className="inline-flex items-center rounded border border-white/12 bg-white/5 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white/95">
                {isTv ? 'Series' : 'Movie'}
              </span>

              {details.year && (
                <span className="inline-flex items-center rounded border border-white/8 bg-white/5 px-2 py-0.5 text-xs font-bold text-white/85">
                  {details.year}
                </span>
              )}

              <span className="rounded border border-white/8 bg-white/5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white/70">
                4K Ultra HD
              </span>

              {details.director && (
                <>
                  <span className="text-white/20">·</span>
                  <span className="font-semibold text-white/90">Director: {details.director}</span>
                </>
              )}
            </div>

            {/* Genre tags */}
            {details.genre && (
              <div className="mt-5 flex flex-wrap gap-2">
                {details.genre.split(',').map((g) => (
                  <span
                    key={g}
                    className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:border-white/20 cursor-default"
                  >
                    {g.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Provider and Audio track availability */}
            {hasStreams && (
              <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-wider text-mz-secondary">
                {isAutomatic ? (
                  <span>Streaming Sources: <span className="text-white">Automatic Source Selection</span></span>
                ) : (
                  activeProvider && (
                    <span>Provider: <span className="text-white">{activeProvider}</span></span>
                  )
                )}
                {details.audioLanguages && details.audioLanguages.length > 0 && (
                  <span>Audio: <span className="text-mz-primary">{details.audioLanguages.join(', ')}</span></span>
                )}
              </div>
            )}

            {/* Languages available */}
            {details.languages && details.languages.length > 0 && (
              <div className="mt-5 border-t border-white/5 pt-4">
                <p className="text-xs font-bold uppercase tracking-widest text-mz-secondary">
                  Available Streams
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {details.languages.map((lang, index) => (
                    <span
                      key={`${lang.l}-${index}`}
                      className="rounded border border-mz-primary/20 bg-mz-primary/5 px-2.5 py-1 text-xs font-semibold text-mz-primary"
                    >
                      {lang.l} {lang.s ? `(${lang.s})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Streaming server status indicators — ALL providers, availability from backend pipeline */}
            {details.sources && details.sources.length > 0 && (
              <div className="mt-6 border-t border-white/5 pt-5">
                <div className="flex flex-col gap-1">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-mz-secondary">
                    Streaming Servers
                  </p>
                  <p className="text-2xs font-semibold text-mz-secondary/40">
                    Click a server to play from it directly.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {details.sources.map((src, idx) => {
                    const isAvailable = src.available !== false
                    const isDefault = src.provider === details.defaultProvider
                    const serverNum = src.serverIndex ?? (idx + 1)

                    // Map raw provider IDs to user-friendly display names
                    const providerDisplayName = (() => {
                      switch ((src.provider || '').toLowerCase()) {
                        case 'peachify':     return 'Peachify'
                        case 'streamimdb':   return 'StreamIMDb'
                        case 'autoembed':    return 'AutoEmbed'
                        case 'embedsu':      return 'EmbedSU'
                        case 'vidsrc':       return 'VidSrc'
                        default: {
                          // Capitalise first letter of each word as fallback
                          const n = src.provider || `Server ${serverNum}`
                          return n.charAt(0).toUpperCase() + n.slice(1)
                        }
                      }
                    })()

                    // Always use the mapped display name — src.label from backend is raw lowercase
                    const serverLabel = providerDisplayName
                    const isUnavailable = src.status === 'UNAVAILABLE'

                    return (
                      <button
                        key={`${src.provider}-${src.id}-${idx}`}
                        onClick={() => isAvailable ? handlePlay({ provider: src.provider, id: src.id }) : undefined}
                        title={
                          isAvailable 
                            ? `Play from ${serverLabel}` 
                            : isUnavailable 
                              ? `${serverLabel} - Movie not found on this server` 
                              : `${serverLabel} is currently offline`
                        }
                        disabled={!isAvailable}
                        className={`
                          inline-flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-bold select-none
                          transition-all duration-300 backdrop-blur-md shadow-md
                          ${isAvailable
                            ? isDefault
                              ? 'bg-mz-primary/8 border-mz-primary/35 text-white hover:border-mz-primary/60 hover:bg-mz-primary/15 hover:scale-[1.03] active:scale-[0.97] cursor-pointer'
                              : 'bg-white/[0.03] border-white/5 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white hover:scale-[1.03] active:scale-[0.97] cursor-pointer'
                            : 'bg-white/[0.01] border-white/5 text-mz-secondary/30 cursor-not-allowed opacity-40'
                          }
                        `}
                      >
                        <span className={`
                          h-1.5 w-1.5 rounded-full shrink-0
                          ${isAvailable 
                            ? isDefault
                              ? 'bg-mz-primary animate-pulse shadow-[0_0_8px_var(--mz-primary)]' 
                              : 'bg-emerald-500 shadow-[0_0_8px_#10b981]' 
                            : 'bg-white/10'
                          }
                        `} />
                        <span>{serverLabel}</span>
                        {isDefault && isAvailable && (
                          <span className="rounded bg-mz-primary/15 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-mz-primary border border-mz-primary/15 scale-95 origin-right">
                            Auto
                          </span>
                        )}
                        {!isAvailable && (
                          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-mz-secondary/30 border border-white/5 scale-95 origin-right">
                            {isUnavailable ? 'No Link' : 'Offline'}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}



            {/* Description / Overview */}
            {details.description && (
              <p className="mt-6 max-w-3xl text-base leading-relaxed text-mz-secondary font-medium">
                {details.description}
              </p>
            )}



            {/* Play, Download & Trailer Buttons */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3.5 w-full sm:w-auto">
              <button
                type="button"
                disabled={playing || !hasStreams}
                onClick={() => handlePlay()}
                className="btn-primary w-full sm:w-auto px-8 py-4 text-base"
              >
                <Play className="h-5 w-5 fill-white" />
                {playing ? 'Fetching Streams…' : hasStreams ? 'Watch Now' : 'Streaming Unavailable'}
              </button>

              <DownloadButton
                loading={dl.loading}
                disabled={!hasStreams || !isDownloadSupported}
                onClick={handleDownloadClick}
                label={
                  !hasStreams
                    ? 'Unavailable'
                    : !isDownloadSupported
                      ? 'Coming Soon'
                      : 'Download'
                }
                className="w-full sm:w-auto"
              />

              {details.trailer && (
                <button
                  type="button"
                  onClick={handleTrailer}
                  className="btn-secondary w-full sm:w-auto px-8 py-4 text-base"
                >
                  <Film className="h-5 w-5" />
                  Watch Trailer
                </button>
              )}
            </div>

            {/* TV Series episodic notice */}
            {isTv && (
              <div className="mt-6 max-w-xl rounded-xl border border-white/5 bg-white/[0.02] p-4 text-xs sm:text-sm text-mz-secondary flex items-start gap-2.5">
                <HelpCircle className="h-5 w-5 text-mz-primary shrink-0" />
                <p>
                  This title is a TV series. You can browse seasons, check episode guides, and select individual episodes to watch or download in the section below.
                </p>
              </div>
            )}
          </div>
        </div>

        {isTv && details.seasons && details.seasons.length > 0 && (
          <div className="mt-10 border-t border-white/10 pt-10">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="font-display text-2xl font-bold text-white tracking-tight">
                Seasons & Episodes
              </h2>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-sm font-semibold text-mz-secondary shrink-0">Select Season:</span>
                <select
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  className="w-full sm:w-auto rounded-lg border border-white/10 bg-mz-card px-4 py-2 text-sm font-semibold text-white shadow focus:border-mz-primary focus:outline-none focus:ring-1 focus:ring-mz-primary cursor-pointer"
                >
                  {details.seasons.map((s) => (
                    <option key={s.season_number} value={s.season_number}>
                      {s.name || `Season ${s.season_number}`} ({s.episode_count} Episodes)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loadingEpisodes ? (
              <div className="mt-6 flex flex-col gap-4">
                <Shimmer className="h-28 w-full rounded-xl" />
                <Shimmer className="h-28 w-full rounded-xl" />
                <Shimmer className="h-28 w-full rounded-xl" />
              </div>
            ) : episodes.length === 0 ? (
              <p className="mt-6 text-sm text-mz-secondary font-medium italic">
                No episodes found or provider sources not linked yet.
              </p>
            ) : (
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                {episodes.map((ep) => {
                  const hasEpSource = !!ep.id
                  return (
                    <div
                      key={ep.episode_number}
                      className="group flex flex-col gap-4 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] p-4.5 transition-all duration-300 hover:border-mz-primary/20 hover:shadow-lg hover:shadow-black/50 sm:flex-row items-start"
                    >
                      {/* Episode Thumbnail */}
                      <div
                        onClick={() => {
                          if (hasEpSource) handlePlayEpisode(ep)
                        }}
                        className={`relative aspect-video w-full sm:w-44 shrink-0 overflow-hidden rounded-xl bg-black/40 shadow-inner group/thumb ${hasEpSource ? 'cursor-pointer' : 'cursor-default'
                          }`}
                      >
                        {ep.still_path ? (
                          <img
                            src={ep.still_path}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-mz-secondary">
                            No Thumbnail
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-2xs font-extrabold text-white uppercase tracking-wider border border-white/5">
                          S{selectedSeason} E{ep.episode_number}
                        </span>

                        {hasEpSource && (
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center pointer-events-none">
                            <div className="h-10 w-10 rounded-full bg-mz-primary flex items-center justify-center text-white transform scale-90 group-hover/thumb:scale-100 transition-transform shadow-lg shadow-mz-primary/20">
                              <Play className="h-4.5 w-4.5 fill-white ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Episode details */}
                      <div className="flex flex-1 flex-col justify-between h-full min-h-[105px]">
                        <div>
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-display text-sm sm:text-base font-bold text-white leading-snug line-clamp-1 group-hover:text-mz-primary transition-colors">
                              {ep.episode_number}. {ep.name}
                            </h3>
                          </div>
                          <div className="mt-1 flex items-center gap-x-2 text-2xs text-mz-secondary font-extrabold uppercase tracking-wide">
                            {ep.runtime > 0 && <span>{ep.runtime} min</span>}
                            {ep.runtime > 0 && ep.air_date && <span>·</span>}
                            {ep.air_date && <span>{ep.air_date}</span>}
                          </div>
                          <p className="mt-2 text-xs leading-relaxed text-mz-secondary line-clamp-2 font-medium">
                            {ep.overview || "No episode summary available."}
                          </p>
                        </div>

                        <div className="mt-3.5 flex items-center justify-between gap-3">
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider ${hasEpSource ? 'text-mz-primary' : 'text-zinc-500'}`}>
                            {hasEpSource ? 'Ready to watch' : 'Sources offline'}
                          </span>

                          <button
                            type="button"
                            disabled={playing || !hasEpSource}
                            onClick={() => handlePlayEpisode(ep)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-4.5 py-1.5 text-xs font-bold transition duration-300 cursor-pointer ${hasEpSource
                              ? 'bg-mz-primary/15 border border-mz-primary/30 text-white hover:bg-mz-primary hover:border-mz-primary shadow-sm hover:scale-[1.02]'
                              : 'bg-white/5 text-white/45 border border-white/5 cursor-not-allowed'
                              }`}
                          >
                            <Play className="h-3 w-3 fill-current" />
                            Play
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Cast Section */}
        {details.cast && details.cast.length > 0 && (
          <CastSection cast={details.cast} />
        )}

        {/* Recommendations Section */}
        {details.recommendations && details.recommendations.length > 0 && (
          <RecommendationsSection recommendations={details.recommendations} />
        )}
      </PageContainer>

      {/* Quality picker dialog */}
      <StreamQualityModal
        open={qualityModal != null}
        mode={qualityModal?.mode ?? 'play'}
        title={details.title}
        streams={qualityModal?.streams ?? []}
        onClose={() => setQualityModal(null)}
        onSelect={handleQualitySelect}
      />



      {/* Trailer modal dialog */}
      <TrailerModal
        open={trailerKey != null}
        title={`${details.title} - Trailer`}
        youtubeKey={trailerKey ?? ''}
        onClose={() => setTrailerKey(null)}
      />

      {/* Download modal dialog */}
      <DownloadModal
        isOpen={dl.isOpen}
        loading={dl.loading}
        error={dl.error}
        languages={dl.languages}
        parsedStreams={dl.parsedStreams}
        selectedLanguage={dl.selectedLanguage}
        selectedQuality={dl.selectedQuality}
        metadata={dl.metadata}
        downloadProvider={dl.downloadProvider}
        downloadType={dl.downloadType}
        availableProviders={dl.availableProviders}
        activeProvider={dl.activeProvider}
        onSelectProvider={dl.selectProvider}
        onClose={dl.closeDownload}
        onSelectLanguage={dl.selectLanguage}
        onSelectQuality={dl.selectQuality}
        onDownload={dl.triggerDownload}
        onRetry={dl.retry}
      />

      {/* Floating success toast */}
      <DownloadProgress
        message={dl.toast}
        onDismiss={() => {}}
      />
    </div>
  )
}