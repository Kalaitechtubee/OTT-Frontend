import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { ArrowLeft, X, AlertCircle, RefreshCw } from 'lucide-react'
import Hls from 'hls.js'
import {
  PlayerSettingsPanel,
  type AudioTrackInfo,
  type SubtitleTrackInfo,
} from '@/components/common/PlayerSettingsPanel'
import { usePlayerStore } from '@/store/playerStore'
import { useHistoryStore } from '@/store/historyStore'
import { useThemeStore } from '@/store/themeStore'
import { paths } from '@/routes/paths'
import { getStreamV2, resolveStream } from '@/services/api'
import { buildApiUrl } from '@/services/apiClient'

import type { Movie } from '@/types/movie'
import type { Provider } from '@/types/v2'

/* ─── Constants ───────────────────────────────────────────────────────────── */

const MAX_RECOVERY_ATTEMPTS = 2
const RECOVERY_COOLDOWN_MS = 3000
const SUSTAINED_PLAY_RESET_MS = 3000
const MIN_POSITION_FOR_RESET_S = 2
const HLS_MIME_TYPE = 'application/vnd.apple.mpegurl'

/** Preferred audio languages in priority order (ISO 639-2/3). */
const PREFERRED_AUDIO_LANGS = ['tam', 'eng']

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function isHlsUrl(url: string): boolean {
  return url.toLowerCase().includes('.m3u8')
}

function srtToVtt(srtText: string): string {
  let vtt = srtText.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  vtt = vtt.trim()
  if (!vtt.startsWith('WEBVTT')) {
    vtt = 'WEBVTT\n\n' + vtt
  }
  return vtt
}

async function prepareSubtitleUrl(url: string): Promise<string> {
  if (url.startsWith('blob:')) {
    return url
  }

  const isSrt = url.toLowerCase().includes('.srt')
  const isVtt = url.toLowerCase().includes('.vtt')

  if (isSrt || isVtt) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        const text = await response.text()
        let vttText = text
        if (isSrt && !text.trimStart().startsWith('WEBVTT')) {
          vttText = srtToVtt(text)
        }
        const blob = new Blob([vttText], { type: 'text/vtt;charset=utf-8' })
        return URL.createObjectURL(blob)
      }
    } catch (err) {
      console.warn('Failed to fetch/convert subtitle:', err)
    }
  }
  return url
}

function mediaErrorMessage(code: number): string {
  switch (code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Playback was aborted.'
    case MediaError.MEDIA_ERR_NETWORK:
      return 'Network error while loading the video. Check your connection and try again.'
    case MediaError.MEDIA_ERR_DECODE:
      return 'This video format could not be decoded in your browser.'
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'Stream URL expired or is not supported. Please reload or try another quality.'
    default:
      return 'Playback failed. Please try again.'
  }
}

/**
 * Pick the best default audio track from an HLS.js audioTracks list.
 * Priority: Tamil → English → first track.
 */
function pickDefaultAudioTrack(tracks: AudioTrackInfo[]): number {
  for (const lang of PREFERRED_AUDIO_LANGS) {
    const match = tracks.find(
      (t) => t.language.toLowerCase() === lang.toLowerCase(),
    )
    if (match) return match.id
  }
  return tracks.length > 0 ? tracks[0].id : -1
}

/* ─── PlayerPage ──────────────────────────────────────────────────────────── */

export function PlayerPage() {
  const navigate = useNavigate()
  const { provider, id } = useParams<{ provider: string; id: string }>()
  const [searchParams] = useSearchParams()

  const {
    title,
    poster,
    streamUrl,
    streams,
    selectedQuality,
    playContext,
    setProgress,
    setStreamQuality,
    stop,
    subtitles: storeSubtitles,
    tmdbId,
    mediaType,
    overview,
    streamType,
    embedUrl,
    embedFallbacks,
    variants,
    selectedVariantId,
    setStreamVariant,
    play,
    activePlayingProvider,
  } = usePlayerStore()

  const urlOverrideRaw = searchParams.get('url')
  const urlOverride = useMemo(() => {
    if (!urlOverrideRaw) return null
    try {
      const decoded = decodeURIComponent(urlOverrideRaw)
      return decoded.startsWith('http') ? decoded : urlOverrideRaw
    } catch {
      return urlOverrideRaw
    }
  }, [urlOverrideRaw])

  const effectiveStreamUrl = urlOverride ?? streamUrl

  const [resolvingStream, setResolvingStream] = useState(!effectiveStreamUrl)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const resumeTimeRef = useRef(0)
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const recoveryAttemptsRef = useRef(0)
  const failedQualitiesRef = useRef<Set<string>>(new Set())
  const lastPlaybackPositionRef = useRef(0)
  const isRecoveringRef = useRef(false)
  const recoveryExhaustedRef = useRef(false)
  const lastRecoveryAtRef = useRef(0)
  const recoveryResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [playbackError, setPlaybackError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [videoKey, setVideoKey] = useState(0)
  const [embedFallbackIndex, setEmbedFallbackIndex] = useState(0)

  interface ProviderState {
    name: string
    displayName: string
    status: 'WAITING' | 'TRYING' | 'SUCCESS' | 'FAILED' | 'SKIPPED'
    reason?: string
  }

  const [providerStates, setProviderStates] = useState<ProviderState[]>([
    { name: 'vidsrc-sbs', displayName: 'VidSrc SBS', status: 'WAITING' },
    { name: 'peachify', displayName: 'Peachify', status: 'WAITING' },
    { name: 'streamimdb', displayName: 'StreamIMDb', status: 'WAITING' },
    { name: 'autoembed', displayName: 'AutoEmbed', status: 'WAITING' },
    { name: 'embedsu', displayName: 'EmbedSU', status: 'WAITING' },
    { name: 'vidsrc', displayName: 'VidSrc', status: 'WAITING' }
  ])
  const abortControllerRef = useRef<AbortController | null>(null)

  // Dynamically resolve stream in the background if not pre-loaded (e.g. reload or instant navigation)
  useEffect(() => {
    // If the stream URL is already set and matches the active route ID, we don't need to resolve again
    const matchesProvider = playContext?.provider === provider || (provider === 'tmdb' && playContext?.provider !== undefined)
    if (effectiveStreamUrl && playContext?.id === id && matchesProvider) {
      setResolvingStream(false)
      return
    }

    if (!provider || !id) {
      navigate(paths.home, { replace: true })
      return
    }

    let active = true
    const resolve = async () => {
      setResolvingStream(true)
      setPlaybackError(null)
      try {
        const titleParam = searchParams.get('title') || 'Loading Stream...'
        const posterParam = searchParams.get('poster') || null
        const overviewParam = searchParams.get('overview') || null
        const tmdbIdParam = searchParams.get('tmdbId') || null
        const mediaTypeParam = (searchParams.get('mediaType') as 'movie' | 'tv') || 'movie'
        const dubParam = searchParams.get('dub') || undefined
        const sourcesParam = searchParams.get('sources')
        const seasonParam = searchParams.get('season')
        const episodeParam = searchParams.get('episode')

        let sourcesList: { provider: string; id: string }[] | undefined = undefined
        if (sourcesParam) {
          sourcesList = sourcesParam.split(',').map((s) => {
            const [p, i] = s.split(':')
            return { provider: p, id: i }
          })
        }

        let res

        if (provider === 'tmdb') {
          // Backend-controlled pipeline: backend decides which provider to use.
          let tmdbTarget = id || tmdbIdParam || ''
          const tvMatch = String(tmdbTarget).match(/^(\d+)[-:](\d+)[-:](\d+)$/)
          let season = seasonParam ? parseInt(seasonParam, 10) : undefined
          let episode = episodeParam ? parseInt(episodeParam, 10) : undefined
          if (tvMatch) {
            tmdbTarget = tvMatch[1]
            if (season === undefined) season = parseInt(tvMatch[2], 10)
            if (episode === undefined) episode = parseInt(tvMatch[3], 10)
          }

          const abortController = new AbortController()
          abortControllerRef.current = abortController

          const queryParams: Record<string, string> = {
            type: mediaTypeParam,
          }
          if (season !== undefined) queryParams.season = String(season)
          if (episode !== undefined) queryParams.episode = String(episode)
          if (dubParam) queryParams.variant = dubParam

          const sseResponse = await fetch(
            buildApiUrl(`/api/v2/stream/auto/${tmdbTarget}`, queryParams),
            {
              signal: abortController.signal,
            }
          )

          const reader = sseResponse.body?.getReader()
          if (!reader) throw new Error('Stream failover failed to initialize.')
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (!line.trim()) continue
              const dataStr = line.startsWith('data: ') ? line.substring(6) : line
              try {
                const event = JSON.parse(dataStr)
                
                if (event.status === 'STARTING') {
                  const list = event.providers.map((name: string) => ({
                    name,
                    displayName: name === 'vidsrc-sbs' ? 'VidSrc SBS' :
                                 name === 'peachify' ? 'Peachify' :
                                 name === 'streamimdb' ? 'StreamIMDb' :
                                 name === 'autoembed' ? 'AutoEmbed' :
                                 name === 'embedsu' ? 'EmbedSU' :
                                 name === 'vidsrc' ? 'VidSrc' : name,
                    status: 'WAITING' as const
                  }))
                  setProviderStates(list)
                } else if (event.status === 'TRYING') {
                  setProviderStates((prev) =>
                    prev.map((p) =>
                      p.name === event.provider ? { ...p, status: 'TRYING' } : p
                    )
                  )
                } else if (event.status === 'FAILED') {
                  setProviderStates((prev) =>
                    prev.map((p) =>
                      p.name === event.provider
                        ? { ...p, status: 'FAILED', reason: event.reason || 'Media not found' }
                        : p
                    )
                  )
                } else if (event.status === 'SKIPPED') {
                  setProviderStates((prev) =>
                    prev.map((p) =>
                      p.name === event.provider
                        ? { ...p, status: 'SKIPPED', reason: 'Provider offline' }
                        : p
                    )
                  )
                } else if (event.status === 'SUCCESS') {
                  setProviderStates((prev) =>
                    prev.map((p) =>
                      p.name === event.provider ? { ...p, status: 'SUCCESS' } : p
                    )
                  )
                  res = event.stream
                  break
                } else if (event.status === 'FAILED_ALL') {
                  throw new Error(event.message || 'All providers failed to load.')
                }
              } catch (e) {
                if (e instanceof Error && e.message === 'All providers failed to load.') {
                  throw e
                }
                console.warn('Failed to parse SSE event:', dataStr, e)
              }
            }
            if (res) break
          }
        } else {
          // Explicit provider: user manually selected a server (e.g. tapped 'Server 2').
          // Route directly to that provider — no pipeline involved.
          res = await getStreamV2(provider as any, id, sourcesList, dubParam)
          // Mark selected provider as success
          setProviderStates([
            {
              name: provider,
              displayName: provider === 'vidsrc-sbs' ? 'VidSrc SBS' :
                           provider === 'peachify' ? 'Peachify' :
                           provider === 'streamimdb' ? 'StreamIMDb' :
                           provider === 'autoembed' ? 'AutoEmbed' :
                           provider === 'embedsu' ? 'EmbedSU' :
                           provider === 'vidsrc' ? 'VidSrc' : provider,
              status: 'SUCCESS'
            }
          ])
        }

        if (!active) return

        if (!res) {
          throw new Error('No stream response returned from server.')
        }

        const activeVariants = res.variants || (res as any).stream?.variants || []
        const activeSelectedVariantId = res.selectedVariantId || dubParam || id

        // Populate audio and subtitle tracks from the backend stream object if available
        const backendAudioTracks = res.stream?.audioTracks
        if (backendAudioTracks && Array.isArray(backendAudioTracks)) {
          const mapped = backendAudioTracks.map((t: any, idx: number) => ({
            id: idx,
            language: t.language || 'und',
            label: t.name || t.language || `Track ${idx + 1}`
          }))
          setAudioTracks(mapped)
          let targetId = -1
          if (selectedAudioLanguageRef.current) {
            const match = mapped.find(
              (t) => t.language.toLowerCase() === selectedAudioLanguageRef.current?.toLowerCase()
            )
            if (match) targetId = match.id
          }
          if (targetId === -1) {
            targetId = pickDefaultAudioTrack(mapped)
          }
          if (targetId >= 0) {
            setSelectedAudioTrackId(targetId)
            const track = mapped[targetId]
            selectedAudioLanguageRef.current = track.language || null
          }
        }

        const backendSubtitleTracks = res.stream?.subtitleTracks
        if (backendSubtitleTracks && Array.isArray(backendSubtitleTracks)) {
          const mapped = backendSubtitleTracks.map((t: any, idx: number) => ({
            id: idx,
            language: t.language || 'und',
            label: t.name || t.language || `Subtitle ${idx + 1}`
          }))
          setSubtitleTracks(mapped)
          let targetSubId = -1
          if (selectedSubtitleLanguageRef.current) {
            const match = mapped.find(
              (t) => t.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
            )
            if (match) targetSubId = match.id
          }
          setSelectedSubtitleTrackId(targetSubId)
        }

        if (res.streamType === 'embed' && res.embedUrl) {
          play(
            titleParam,
            posterParam,
            { provider: provider!, id },
            res.embedUrl,
            [],
            'Embed',
            [],
            tmdbIdParam,
            mediaTypeParam,
            overviewParam,
            'embed',
            res.embedUrl,
            activeVariants,
            activeSelectedVariantId,
            res.embedFallbacks || [],
            res.selectedProvider || provider!
          )
        } else if (res.streams && res.streams.length > 0) {
          play(
            titleParam,
            posterParam,
            { provider: provider!, id },
            res.streams[0].url,
            res.streams,
            res.streams[0].quality,
            res.subtitles,
            tmdbIdParam,
            mediaTypeParam,
            overviewParam,
            res.streamType || null,
            null,
            activeVariants,
            activeSelectedVariantId,
            undefined,
            res.selectedProvider || provider!
          )
        } else {
          setPlaybackError('No playback streams available for this title.')
        }
      } catch (err) {
        if (!active) return
        setPlaybackError(err instanceof Error ? err.message : 'Failed to fetch stream details.')
      } finally {
        if (active) {
          setResolvingStream(false)
        }
      }
    }


    resolve()

    return () => {
      active = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [provider, id, effectiveStreamUrl, playContext])

  /* ── Audio / Subtitle / Quality state ── */
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([])
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState(-1)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([])
  const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState(-1) // -1 = off
  const hasAutoSelectedAudioRef = useRef(false)

  const items = useHistoryStore((s) => s.items)
  const addOrUpdate = useHistoryStore((s) => s.addOrUpdate)

  // Find matching history item to resume
  const historyItem = useMemo(() => {
    return items.find(
      (item) =>
        (tmdbId && item.movie.id === Number(tmdbId) && item.movie.type === mediaType) ||
        (item.playContext?.provider === playContext?.provider &&
          item.playContext?.id === playContext?.id)
    )
  }, [items, tmdbId, mediaType, playContext])

  useEffect(() => {
    if (historyItem && historyItem.progress > 0) {
      resumeTimeRef.current = historyItem.progress
      console.log(`[Player] Found matching history item at progress ${historyItem.progress}s. Will resume there.`)
    } else {
      resumeTimeRef.current = 0
    }
  }, [historyItem])

  // Reset embed fallback index when a new embed stream is loaded
  useEffect(() => {
    setEmbedFallbackIndex(0)
  }, [embedUrl])

  /* Persistent selections across quality changes & recovery */
  const selectedAudioLanguageRef = useRef<string | null>(null)
  const selectedSubtitleLanguageRef = useRef<string | null>(null)

  // Reset persistent settings only when a completely different movie/episode is played
  const prevPlayContextRef = useRef<string | null>(null)
  const currentContextKey = playContext ? `${playContext.provider}_${playContext.id}` : null
  if (currentContextKey !== prevPlayContextRef.current) {
    prevPlayContextRef.current = currentContextKey
    selectedAudioLanguageRef.current = null
    selectedSubtitleLanguageRef.current = null
  }

  const [processedSubtitles, setProcessedSubtitles] = useState<any[]>([])

  useEffect(() => {
    let active = true
    const blobUrls: string[] = []

    const process = async () => {
      if (!storeSubtitles || storeSubtitles.length === 0) {
        setProcessedSubtitles([])
        return
      }

      const list = await Promise.all(
        storeSubtitles.map(async (sub) => {
          const processedUrl = await prepareSubtitleUrl(sub.url)
          if (processedUrl.startsWith('blob:')) {
            blobUrls.push(processedUrl)
          }
          return {
            ...sub,
            url: processedUrl,
          }
        })
      )

      if (active) {
        setProcessedSubtitles(list)
      }
    }

    process()

    return () => {
      active = false
      blobUrls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [storeSubtitles])

  const effectiveSubtitleTracks = useMemo<SubtitleTrackInfo[]>(() => {
    if (subtitleTracks.length > 0) {
      return subtitleTracks
    }
    return processedSubtitles.map((sub, idx) => ({
      id: idx,
      language: sub.language,
      label: sub.label,
    }))
  }, [subtitleTracks, processedSubtitles])

  // Synchronize HTML5 text track visibility with selectedSubtitleTrackId state
  useEffect(() => {
    const video = videoRef.current
    if (!video || subtitleTracks.length > 0) return

    const tracks = video.textTracks

    const syncTracks = () => {
      let targetIndex = selectedSubtitleTrackId

      // Try to restore previous subtitle language if we have one and currently off (-1)
      if (targetIndex === -1 && selectedSubtitleLanguageRef.current && processedSubtitles.length > 0) {
        const matchIdx = processedSubtitles.findIndex(
          (sub) => sub.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
        )
        if (matchIdx >= 0) {
          targetIndex = matchIdx
          setSelectedSubtitleTrackId(matchIdx)
        }
      }

      console.log('[Subtitles Effect] Syncing HTML5 subtitle tracks. Count:', tracks.length, 'Target Index:', targetIndex)
      for (let i = 0; i < tracks.length; i++) {
        if (i === targetIndex) {
          tracks[i].mode = 'showing'
        } else {
          tracks[i].mode = 'disabled'
        }
      }
    }

    syncTracks()

    tracks.addEventListener('addtrack', syncTracks)
    tracks.addEventListener('removetrack', syncTracks)
    return () => {
      tracks.removeEventListener('addtrack', syncTracks)
      tracks.removeEventListener('removetrack', syncTracks)
    }
  }, [processedSubtitles, selectedSubtitleTrackId, subtitleTracks, videoKey, streamUrl])



  /* ── Quality options for settings panel ── */
  const qualityOptions = useMemo(
    () => streams.map((s) => ({ value: s.quality, label: `${s.quality} Stream` })),
    [streams],
  )

  /* ── Stream recovery / refresh ── */
  const fetchFreshStream = async (
    savedPos: number,
    targetQuality?: string,
  ): Promise<boolean> => {
    if (!playContext) return false
    try {
      let freshResult
      if (playContext.provider === 'tmdb') {
        const seasonParam = searchParams.get('season')
        const episodeParam = searchParams.get('episode')
        let season = seasonParam ? parseInt(seasonParam, 10) : undefined
        let episode = episodeParam ? parseInt(episodeParam, 10) : undefined

        const compositeMatch = String(id).match(/^(\d+)[-:](\d+)[-:](\d+)$/)
        if (compositeMatch) {
          if (season === undefined) season = parseInt(compositeMatch[2], 10)
          if (episode === undefined) episode = parseInt(compositeMatch[3], 10)
        }

        freshResult = await resolveStream(
          tmdbId || playContext.id,
          mediaType || 'movie',
          season,
          episode,
          selectedVariantId || undefined
        )
      } else {
        freshResult = await getStreamV2(
          playContext.provider as Provider,
          playContext.id,
        )
      }

      const freshStreams = freshResult.streams
      if (!freshStreams.length) return false

      // Update audio and subtitle tracks if returned
      const freshAudioTracks = freshResult.stream?.audioTracks
      if (freshAudioTracks && Array.isArray(freshAudioTracks)) {
        const mapped = freshAudioTracks.map((t: any, idx: number) => ({
          id: idx,
          language: t.language || 'und',
          label: t.name || t.language || `Track ${idx + 1}`
        }))
        setAudioTracks(mapped)
        let targetId = -1
        if (selectedAudioLanguageRef.current) {
          const match = mapped.find(
            (t) => t.language.toLowerCase() === selectedAudioLanguageRef.current?.toLowerCase()
          )
          if (match) targetId = match.id
        }
        if (targetId === -1) {
          targetId = pickDefaultAudioTrack(mapped)
        }
        if (targetId >= 0) {
          setSelectedAudioTrackId(targetId)
          const track = mapped[targetId]
          selectedAudioLanguageRef.current = track.language || null
        }
      }

      const freshSubtitleTracks = freshResult.stream?.subtitleTracks
      if (freshSubtitleTracks && Array.isArray(freshSubtitleTracks)) {
        const mapped = freshSubtitleTracks.map((t: any, idx: number) => ({
          id: idx,
          language: t.language || 'und',
          label: t.name || t.language || `Subtitle ${idx + 1}`
        }))
        setSubtitleTracks(mapped)
        let targetSubId = -1
        if (selectedSubtitleLanguageRef.current) {
          const match = mapped.find(
            (t) => t.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
          )
          if (match) targetSubId = match.id
        }
        setSelectedSubtitleTrackId(targetSubId)
      }

      const qualityToUse = targetQuality ?? selectedQuality
      const match =
        freshStreams.find((s) => s.quality === qualityToUse) || freshStreams[0]
      if (!match) return false

      resumeTimeRef.current = savedPos
      hasAutoSelectedAudioRef.current = false // re-auto-select on new source
      setVideoKey((prev) => prev + 1)
      setStreamQuality(match.url, match.quality, freshStreams)
      return true
    } catch (e) {
      console.error('Error fetching fresh stream:', e)
      return false
    }
  }

  const retryCurrentUrl = (savedPos: number): boolean => {
    const video = videoRef.current
    if (!video || !streamUrl) return false
    resumeTimeRef.current = savedPos
    hasAutoSelectedAudioRef.current = false
    setVideoKey((prev) => prev + 1)
    return true
  }

  const handleRefreshStream = async () => {
    if (urlOverride) return
    if (!playContext || !effectiveStreamUrl) return
    setRefreshing(true)
    setPlaybackError(null)
    setStatusMessage('Refreshing stream connection...')

    recoveryAttemptsRef.current = 0
    failedQualitiesRef.current.clear()
    recoveryExhaustedRef.current = false
    isRecoveringRef.current = false

    const video = videoRef.current
    const savedPos =
      video?.currentTime ?? lastPlaybackPositionRef.current ?? 0

    const ok = await fetchFreshStream(savedPos)
    if (!ok) {
      setPlaybackError(
        'Could not retrieve a fresh stream link. The video source might be down.',
      )
      setStatusMessage(null)
    } else {
      setStatusMessage(null)
    }
    setRefreshing(false)
  }

  /* ── Redirect if no stream ── */
  useEffect(() => {
    if (!effectiveStreamUrl && !resolvingStream && !playbackError) {
      navigate(paths.home, { replace: true })
    }
  }, [effectiveStreamUrl, resolvingStream, playbackError, navigate])

  /* ── Stop player on unmount (StrictMode-safe) ── */
  useEffect(() => {
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current)
      stopTimerRef.current = null
    }

    return () => {
      stopTimerRef.current = setTimeout(() => {
        stop()
      }, 100)
    }
  }, [stop])

  /* ── Progress / history tracking ── */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !effectiveStreamUrl) return

    const onTime = () => {
      if (!video.duration) return
      const pct = (video.currentTime / video.duration) * 100
      setProgress(pct)

      const historyMovie: Movie = {
        id: Number(tmdbId || 0),
        title: title ?? 'V2 Playback',
        overview: overview ?? '',
        type: mediaType ?? 'movie',
        posterPath: poster ?? undefined,
        rating: 0,
        releaseDate: '',
      }

      addOrUpdate({
        movie: historyMovie,
        progress: video.currentTime,
        duration: video.duration,
        playContext: playContext ?? undefined,
      })

      if (
        video.currentTime >= MIN_POSITION_FOR_RESET_S &&
        !video.paused &&
        !isRecoveringRef.current
      ) {
        if (recoveryResetTimerRef.current) {
          clearTimeout(recoveryResetTimerRef.current)
        }
        recoveryResetTimerRef.current = setTimeout(() => {
          if (
            videoRef.current &&
            videoRef.current.currentTime >= MIN_POSITION_FOR_RESET_S &&
            !videoRef.current.paused
          ) {
            recoveryAttemptsRef.current = 0
            recoveryExhaustedRef.current = false
            setStatusMessage(null)
          }
        }, SUSTAINED_PLAY_RESET_MS)
      }
    }

    const onSyncForced = () => {
      if (!video.duration || video.currentTime === 0) return
      const historyMovie: Movie = {
        id: Number(tmdbId || 0),
        title: title ?? 'V2 Playback',
        overview: overview ?? '',
        type: mediaType ?? 'movie',
        posterPath: poster ?? undefined,
        rating: 0,
        releaseDate: '',
      }
      addOrUpdate({
        movie: historyMovie,
        progress: video.currentTime,
        duration: video.duration,
        playContext: playContext ?? undefined,
      }, true)
    }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('pause', onSyncForced)

    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('pause', onSyncForced)
      onSyncForced()
      if (recoveryResetTimerRef.current) {
        clearTimeout(recoveryResetTimerRef.current)
      }
    }
  }, [title, poster, setProgress, addOrUpdate, effectiveStreamUrl, tmdbId, mediaType, overview, playContext])

  // Track history for embed-type streams
  useEffect(() => {
    if (streamType === 'embed' && effectiveStreamUrl && title) {
      const historyMovie: Movie = {
        id: Number(tmdbId || 0),
        title: title ?? 'V2 Playback',
        overview: overview ?? '',
        type: mediaType ?? 'movie',
        posterPath: poster ?? undefined,
        rating: 0,
        releaseDate: '',
      }

      addOrUpdate({
        movie: historyMovie,
        progress: 0,
        duration: 0,
        playContext: playContext ?? undefined,
      })
    }
  }, [streamType, effectiveStreamUrl, title, tmdbId, mediaType, overview, playContext, addOrUpdate])

  /* ───────────────────────────────────────────────────────────────────────── */
  /* ── HLS.js initialization + Audio / Subtitle track detection ────────── */
  /* ───────────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !effectiveStreamUrl) return

    const teardown = () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      video.removeAttribute('src')
      video.load()
    }

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    // Reset track state for new source
    setAudioTracks([])
    setSubtitleTracks([])
    setSelectedAudioTrackId(-1)
    setSelectedSubtitleTrackId(-1)
    hasAutoSelectedAudioRef.current = false

    const isHls = isHlsUrl(effectiveStreamUrl)
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream
    const nativeHls =
      video.canPlayType(HLS_MIME_TYPE) !== '' && (isSafari || isIOS)

    console.log('--- Initializing player ---')
    console.log('Stream URL:', effectiveStreamUrl)
    console.log('isHls:', isHls, 'nativeHls:', nativeHls, 'Hls.isSupported():', Hls.isSupported())

    if (isHls && !nativeHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        debug: false,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      })
      hlsRef.current = hls
      if (typeof window !== 'undefined') {
        ; (window as any).hls = hls
      }
      hls.attachMedia(video)
      hls.loadSource(effectiveStreamUrl)

      /* ── MANIFEST_PARSED: Detect audio + subtitle tracks ── */
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[HLS.js] MANIFEST_PARSED — Audio tracks:', hls.audioTracks.length, 'Subtitle tracks:', hls.subtitleTracks.length)

        // ── Audio tracks ──
        const audioList: AudioTrackInfo[] = hls.audioTracks.map((t, idx) => ({
          id: idx,
          language: t.lang ?? 'und',
          label: t.name ?? t.lang ?? `Track ${idx + 1}`,
        }))
        setAudioTracks(audioList)
        console.log('[HLS.js] Audio tracks detected:', JSON.stringify(audioList))

        // Select audio: prefer previously selected language, then default
        if (audioList.length > 0) {
          let targetId = -1
          if (selectedAudioLanguageRef.current) {
            const match = audioList.find(
              (t) => t.language.toLowerCase() === selectedAudioLanguageRef.current?.toLowerCase()
            )
            if (match) targetId = match.id
          }
          if (targetId === -1) {
            targetId = pickDefaultAudioTrack(audioList)
          }
          if (targetId >= 0) {
            hls.audioTrack = targetId
            setSelectedAudioTrackId(targetId)
            hasAutoSelectedAudioRef.current = true
            console.log('[HLS.js] Selected audio track index:', targetId)
            const track = hls.audioTracks[targetId]
            if (track) {
              selectedAudioLanguageRef.current = track.lang || null
            }
          }
        }

        // ── Subtitle tracks (from HLS.js) ──
        const subList: SubtitleTrackInfo[] = hls.subtitleTracks.map(
          (t, idx) => ({
            id: idx,
            language: t.lang ?? 'und',
            label: t.name ?? t.lang ?? `Subtitle ${idx + 1}`,
          }),
        )

        // Also merge subtitles from the backend (storeSubtitles) if they are
        // not already represented in the HLS.js subtitle tracks.
        if (storeSubtitles && storeSubtitles.length > 0 && subList.length === 0) {
          // Backend subtitles only — use <track> elements instead
          console.log('[HLS.js] No HLS subtitle tracks; using backend subtitles via <track> elements')
        }

        setSubtitleTracks(subList)
        console.log('[HLS.js] Subtitle tracks detected:', JSON.stringify(subList))

        // Select subtitle: prefer previously selected language, default to -1 (Off)
        let targetSubId = -1
        if (selectedSubtitleLanguageRef.current && subList.length > 0) {
          const match = subList.find(
            (t) => t.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
          )
          if (match) targetSubId = match.id
        }
        hls.subtitleTrack = targetSubId
        hls.subtitleDisplay = targetSubId >= 0
        setSelectedSubtitleTrackId(targetSubId)

        // ── Quality level selection ──
        if (selectedQuality && hls.levels.length > 0) {
          const height = parseInt(selectedQuality, 10)
          const idx = hls.levels.findIndex((l) => l.height === height)
          if (idx !== -1) {
            console.log(`[HLS.js] Setting initial quality level index ${idx} for quality ${selectedQuality}`)
            hls.currentLevel = idx
          }
        }
      })

      /* ── AUDIO_TRACKS_UPDATED: Live updates ── */
      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        const audioList: AudioTrackInfo[] = hls.audioTracks.map((t, idx) => ({
          id: idx,
          language: t.lang ?? 'und',
          label: t.name ?? t.lang ?? `Track ${idx + 1}`,
        }))
        setAudioTracks(audioList)

        if (audioList.length > 0) {
          let targetId = -1
          if (selectedAudioLanguageRef.current) {
            const match = audioList.find(
              (t) => t.language.toLowerCase() === selectedAudioLanguageRef.current?.toLowerCase()
            )
            if (match) targetId = match.id
          }
          if (targetId === -1 && !hasAutoSelectedAudioRef.current) {
            targetId = pickDefaultAudioTrack(audioList)
          }
          if (targetId >= 0) {
            hls.audioTrack = targetId
            setSelectedAudioTrackId(targetId)
            hasAutoSelectedAudioRef.current = true
            const track = hls.audioTracks[targetId]
            if (track) {
              selectedAudioLanguageRef.current = track.lang || null
            }
          }
        }
      })

      /* ── SUBTITLE_TRACKS_UPDATED: Live updates ── */
      hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, () => {
        const subList: SubtitleTrackInfo[] = hls.subtitleTracks.map(
          (t, idx) => ({
            id: idx,
            language: t.lang ?? 'und',
            label: t.name ?? t.lang ?? `Subtitle ${idx + 1}`,
          }),
        )
        setSubtitleTracks(subList)

        if (subList.length > 0) {
          let targetSubId = -1
          if (selectedSubtitleLanguageRef.current) {
            const match = subList.find(
              (t) => t.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
            )
            if (match) targetSubId = match.id
          }
          hls.subtitleTrack = targetSubId
          hls.subtitleDisplay = targetSubId >= 0
          setSelectedSubtitleTrackId(targetSubId)
        }
      })

      /* ── Error handling ── */
      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn('[HLS.js ERROR]', data.type, data.details)
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          hls.startLoad()
          return
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }
        if (allEmbedSources.length > 0) {
          setStatusMessage('Stream error. Switching to fallback embed player...')
          setTimeout(() => {
            usePlayerStore.setState({ streamType: 'embed' })
            setVideoKey((prev) => prev + 1)
            setStatusMessage(null)
          }, 1500)
          return
        }
        setPlaybackError(
          'Stream URL expired, blocked, or could not be decoded. Open DevTools Console for details.',
        )
      })
    } else {
      video.src = effectiveStreamUrl
    }

    return teardown
  }, [effectiveStreamUrl, videoKey])

  /* ── Playback start + error recovery ── */
  useEffect(() => {
    const video = videoRef.current
    if (!video || !effectiveStreamUrl) return

    const resumeAt = resumeTimeRef.current
    resumeTimeRef.current = 0

    const onError = async () => {
      if (isRecoveringRef.current || recoveryExhaustedRef.current) return

      const now = Date.now()
      if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) return

      const code = video.error?.code ?? 0
      const savedPos = video.currentTime
      lastPlaybackPositionRef.current = savedPos

      console.warn(
        `[PlayerPage] Video error: code=${code}, pos=${savedPos}, attempt=${recoveryAttemptsRef.current}`,
      )

      isRecoveringRef.current = true
      lastRecoveryAtRef.current = now
      video.pause()

      try {
        if (recoveryAttemptsRef.current < MAX_RECOVERY_ATTEMPTS) {
          recoveryAttemptsRef.current += 1
          setStatusMessage(
            `Playback issue detected. Retrying... (Attempt ${recoveryAttemptsRef.current}/${MAX_RECOVERY_ATTEMPTS})`,
          )

          const ok =
            recoveryAttemptsRef.current === 1
              ? retryCurrentUrl(savedPos)
              : await fetchFreshStream(savedPos)

          if (ok) {
            setStatusMessage(null)
            return
          }
        }

        failedQualitiesRef.current.add(selectedQuality)

        const availableStreams = streams.filter(
          (s) =>
            s.quality !== selectedQuality &&
            !failedQualitiesRef.current.has(s.quality),
        )

        if (availableStreams.length > 0) {
          const fallback = availableStreams[0]
          setStatusMessage(
            `Quality ${selectedQuality} failed. Falling back to ${fallback.quality}...`,
          )
          recoveryAttemptsRef.current = 0
          const ok = await fetchFreshStream(savedPos, fallback.quality)
          if (ok) {
            setStatusMessage(null)
            return
          }
        }

        recoveryExhaustedRef.current = true
        setStatusMessage(null)
        if (allEmbedSources.length > 0) {
          setStatusMessage('Playback error. Switching to fallback embed player...')
          setTimeout(() => {
            usePlayerStore.setState({ streamType: 'embed' })
            setVideoKey((prev) => prev + 1)
            setStatusMessage(null)
          }, 1500)
          return
        }
        setPlaybackError(mediaErrorMessage(code))
      } catch (err) {
        console.error('Playback recovery error:', err)
      } finally {
        isRecoveringRef.current = false
      }
    }

    const applySubtitles = () => {
      if (subtitleTracks.length > 0) return
      const tracks = video.textTracks
      console.log('[Subtitles] Loadedmetadata applying index:', selectedSubtitleTrackId, 'to tracks:', tracks.length)
      for (let i = 0; i < tracks.length; i++) {
        if (i === selectedSubtitleTrackId) {
          tracks[i].mode = 'showing'
        } else {
          tracks[i].mode = 'disabled'
        }
      }
    }

    const startPlayback = () => {
      if (resumeAt > 0 && Number.isFinite(video.duration)) {
        video.currentTime = Math.min(resumeAt, video.duration)
      }
      void video.play().catch(() => {
        setPlaybackError(
          'Autoplay was blocked. Press play on the video controls.',
        )
      })
    }

    video.addEventListener('error', onError)

    const onMetadata = () => {
      startPlayback()
      applySubtitles()
    }

    if (video.readyState >= 1) {
      startPlayback()
      applySubtitles()
    } else {
      video.addEventListener('loadedmetadata', onMetadata, { once: true })
    }

    return () => {
      video.removeEventListener('error', onError)
      video.removeEventListener('loadedmetadata', onMetadata)
    }
  }, [effectiveStreamUrl, selectedQuality, streams, playContext, selectedSubtitleTrackId, subtitleTracks, processedSubtitles])

  /* ─── Audio track change handler ─── */
  const handleAudioTrackChange = useCallback(
    (trackId: number) => {
      const hls = hlsRef.current
      if (hls) {
        console.log('[Settings] Switching audio track to index:', trackId)
        hls.audioTrack = trackId
        setSelectedAudioTrackId(trackId)
        const track = hls.audioTracks[trackId]
        if (track) {
          selectedAudioLanguageRef.current = track.lang || null
        }
      }
    },
    [],
  )

  /* ─── Subtitle track change handler ─── */
  const handleSubtitleTrackChange = useCallback(
    (trackId: number) => {
      setSelectedSubtitleTrackId(trackId)
      console.log('[Subtitles] Target Subtitle trackId:', trackId)

      const hls = hlsRef.current
      if (hls && hls.subtitleTracks.length > 0) {
        console.log('[Subtitles] Switching HLS.js subtitle track to index:', trackId)
        hls.subtitleTrack = trackId // -1 turns subtitles off
        hls.subtitleDisplay = trackId >= 0
        const track = hls.subtitleTracks[trackId]
        selectedSubtitleLanguageRef.current = track ? (track.lang || null) : null

        console.log('[Subtitles] Active HLS.js track:', track)
        console.log('[Subtitles] hls.subtitleTrack is now:', hls.subtitleTrack)
        console.log('[Subtitles] hls.subtitleDisplay is now:', hls.subtitleDisplay)

        // Log browser TextTracks status
        const video = videoRef.current
        if (video) {
          setTimeout(() => {
            console.log('[Subtitles] Browser TextTracks count:', video.textTracks.length)
            for (let i = 0; i < video.textTracks.length; i++) {
              const t = video.textTracks[i]
              console.log(`  Track ${i}: language=${t.language}, mode=${t.mode}, label=${t.label}`)
            }
          }, 100)
        }
      } else {
        const video = videoRef.current
        if (video) {
          console.log('[Subtitles] Switching HTML5 video track to index:', trackId)
          const tracks = video.textTracks
          console.log('[Subtitles] HTML5 TextTracks count:', tracks.length)
          for (let i = 0; i < tracks.length; i++) {
            if (i === trackId) {
              tracks[i].mode = 'showing'
            } else {
              tracks[i].mode = 'disabled'
            }
            console.log(`  Track ${i} (${tracks[i].label}): mode set to ${tracks[i].mode}`)
          }
          const sub = subtitleTracks[trackId] || processedSubtitles[trackId]
          selectedSubtitleLanguageRef.current = sub ? (sub.language || null) : null
          console.log('[Subtitles] Selected subtitle language:', selectedSubtitleLanguageRef.current)
        }
      }
    },
    [subtitleTracks, processedSubtitles],
  )

  /* ─── Audio Language Variant change handler ─── */
  const handleVariantChange = useCallback(
    async (variantId: string) => {
      if (!playContext) return
      const targetVariant = variants.find((v) => v.id === variantId)
      const targetLangName = targetVariant ? targetVariant.language : 'Selected Language'

      const video = videoRef.current
      const savedPos = video?.currentTime ?? 0

      setStatusMessage(`Switching to ${targetLangName}...`)
      setPlaybackError(null)

      try {
        const seasonParam = searchParams.get('season')
        const episodeParam = searchParams.get('episode')
        let season = seasonParam ? parseInt(seasonParam, 10) : undefined
        let episode = episodeParam ? parseInt(episodeParam, 10) : undefined

        const compositeMatch = String(id).match(/^(\d+)[-:](\d+)[-:](\d+)$/)
        if (compositeMatch) {
          if (season === undefined) season = parseInt(compositeMatch[2], 10)
          if (episode === undefined) episode = parseInt(compositeMatch[3], 10)
        }

        let result
        const activeProvider = playContext.provider
        if (activeProvider === 'tmdb') {
          result = await resolveStream(
            tmdbId || playContext.id,
            mediaType || 'movie',
            season,
            episode,
            variantId
          )
        } else {
          result = await getStreamV2(
            activeProvider as Provider,
            variantId,
            undefined,
            undefined,
            season,
            episode
          )
        }

        // Populate audio and subtitle tracks from the backend stream object if available
        const backendAudioTracks = result.stream?.audioTracks
        if (backendAudioTracks && Array.isArray(backendAudioTracks)) {
          const mapped = backendAudioTracks.map((t: any, idx: number) => ({
            id: idx,
            language: t.language || 'und',
            label: t.name || t.language || `Track ${idx + 1}`
          }))
          setAudioTracks(mapped)
          let targetId = -1
          if (selectedAudioLanguageRef.current) {
            const match = mapped.find(
              (t) => t.language.toLowerCase() === selectedAudioLanguageRef.current?.toLowerCase()
            )
            if (match) targetId = match.id
          }
          if (targetId === -1) {
            targetId = pickDefaultAudioTrack(mapped)
          }
          if (targetId >= 0) {
            setSelectedAudioTrackId(targetId)
            const track = mapped[targetId]
            selectedAudioLanguageRef.current = track.language || null
          }
        } else {
          setAudioTracks([])
          setSelectedAudioTrackId(-1)
        }

        const backendSubtitleTracks = result.stream?.subtitleTracks
        if (backendSubtitleTracks && Array.isArray(backendSubtitleTracks)) {
          const mapped = backendSubtitleTracks.map((t: any, idx: number) => ({
            id: idx,
            language: t.language || 'und',
            label: t.name || t.language || `Subtitle ${idx + 1}`
          }))
          setSubtitleTracks(mapped)
          let targetSubId = -1
          if (selectedSubtitleLanguageRef.current) {
            const match = mapped.find(
              (t) => t.language.toLowerCase() === selectedSubtitleLanguageRef.current?.toLowerCase()
            )
            if (match) targetSubId = match.id
          }
          setSelectedSubtitleTrackId(targetSubId)
        } else {
          setSubtitleTracks([])
          setSelectedSubtitleTrackId(-1)
        }

        const resolvedVariantId = result.selectedVariantId || variantId

        // Support both embed and native streams
        if (result.streamType === 'embed' && result.embedUrl) {
          resumeTimeRef.current = savedPos
          setVideoKey((prev) => prev + 1)

          setStreamVariant(
            result.embedUrl,
            resolvedVariantId,
            'Embed',
            [],
            [],
            'embed',
            result.embedUrl
          )
          setStatusMessage(null)
          return
        }

        const freshStreams = result.streams
        if (!freshStreams.length) {
          setPlaybackError(`No playback streams available for ${targetLangName}.`)
          setStatusMessage(null)
          return
        }

        // Match closest quality to current or pick first
        const match =
          freshStreams.find((s) => s.quality === selectedQuality) || freshStreams[0]

        resumeTimeRef.current = savedPos
        hasAutoSelectedAudioRef.current = false
        setVideoKey((prev) => prev + 1)

        setStreamVariant(
          match.url,
          resolvedVariantId,
          match.quality,
          freshStreams,
          result.subtitles,
          result.streamType || 'hls',
          null
        )
        setStatusMessage(null)
      } catch (err) {
        console.error('Failed to change audio variant:', err)
        setPlaybackError(`Failed to load ${targetLangName} audio stream.`)
        setStatusMessage(null)
      }
    },
    [playContext, selectedQuality, variants, setStreamVariant, searchParams, id, tmdbId, mediaType]
  )

  /* ─── Quality change handler ─── */
  const handleQualityChange = useCallback(
    (value: string) => {
      const stream = streams.find((item) => item.quality === value)
      if (!stream) return

      const hls = hlsRef.current
      if (hls && hls.levels.length > 0) {
        const height = parseInt(value, 10)
        const idx = hls.levels.findIndex((l) => l.height === height)
        if (idx !== -1) {
          console.log(`[PlayerPage] Quality switch (HLS.js level): matching level index ${idx} found for height ${height}`)
          hls.currentLevel = idx
          setStreamQuality(streamUrl || '', value)
          return
        }
      }

      if (stream.url === streamUrl) return

      const video = videoRef.current
      resumeTimeRef.current = video?.currentTime ?? 0

      recoveryAttemptsRef.current = 0
      failedQualitiesRef.current.clear()
      recoveryExhaustedRef.current = false
      isRecoveringRef.current = false
      hasAutoSelectedAudioRef.current = false

      setPlaybackError(null)
      setStatusMessage(null)
      setVideoKey((prev) => prev + 1)
      setStreamQuality(stream.url, stream.quality)
    },
    [streams, streamUrl, setStreamQuality],
  )
  const showVideoPlaceholder = resolvingStream || !effectiveStreamUrl

  const close = () => {
    if (provider === 'tmdb' && tmdbId) {
      navigate(paths.tmdbDetail(tmdbId, { type: mediaType || 'movie', title: title || '' }))
    } else if (playContext) {
      navigate(paths.detail(playContext.provider, playContext.id))
    } else {
      navigate(paths.home)
    }
  }

  const primaryColorHex = useThemeStore((s) => s.colors.primary).replace('#', '')

  // Compute the active embed URL (cycles through fallbacks on user request)
  const allEmbedSources = embedFallbacks && embedFallbacks.length > 0
    ? embedFallbacks
    : embedUrl
      ? [embedUrl]
      : []
  const rawActiveEmbedUrl = allEmbedSources[embedFallbackIndex] || embedUrl || effectiveStreamUrl || ''

  const activeEmbedUrl = useMemo(() => {
    if (!rawActiveEmbedUrl) return ''
    let finalUrl = rawActiveEmbedUrl
    try {
      const urlObj = new URL(rawActiveEmbedUrl)
      const host = urlObj.hostname.toLowerCase()
      const deadDomains = [
        'vidsrc.me', 'vidsrc.xyz', 'vidsrc.in', 'vidsrc.pm', 'vidsrc.net',
        'vidsrc.io', 'vidsrc.vc', 'vidsrc.bz', 'vidsrc.gd', 'vidsrc.do',
        'vidsrc.mn', 'vidsrc.tw'
      ]
      
      const isDead = deadDomains.some(d => host === d || host.endsWith('.' + d))
      if (isDead) {
        const tmdbIdVal = urlObj.searchParams.get('tmdb') || urlObj.searchParams.get('id') || tmdbId || ''
        const isTv = urlObj.pathname.includes('/tv') || urlObj.searchParams.has('season') || mediaType === 'tv'
        
        if (tmdbIdVal) {
          if (isTv) {
            const s = urlObj.searchParams.get('season') || urlObj.searchParams.get('s') || '1'
            const e = urlObj.searchParams.get('episode') || urlObj.searchParams.get('e') || '1'
            finalUrl = `https://vidsrc.sbs/embed/tv/${tmdbIdVal}/${s}/${e}/?autoplay=1&color=e50914`
          } else {
            finalUrl = `https://vidsrc.sbs/embed/movie/${tmdbIdVal}/?autoplay=1&color=e50914`
          }
        } else {
          const segments = urlObj.pathname.split('/').filter(Boolean)
          if (segments.length >= 2) {
            const typeSegment = segments[0]
            const idSegment = segments[1]
            if (typeSegment === 'tv' && segments.length >= 4) {
              finalUrl = `https://vidsrc.sbs/embed/tv/${idSegment}/${segments[2]}/${segments[3]}/?autoplay=1&color=e50914`
            } else {
              finalUrl = `https://vidsrc.sbs/embed/movie/${idSegment}/?autoplay=1&color=e50914`
            }
          }
        }
      } else if (host.includes('vidsrc.sbs')) {
        urlObj.searchParams.set('autoplay', '1')
        urlObj.searchParams.set('color', 'e50914')
        finalUrl = urlObj.toString()
      } else if (host.includes('peachify.top') || host.includes('eat-peach.sbs')) {
        urlObj.searchParams.set('accent', primaryColorHex)
        finalUrl = urlObj.toString()
      }
    } catch (e) {
      console.warn("URL rewriting failed:", e)
    }
    return finalUrl
  }, [rawActiveEmbedUrl, primaryColorHex, tmdbId, mediaType])



  /* ── Determine subtitle rendering strategy ──
   * If HLS.js provides subtitle tracks → use hls.subtitleTrack (in-band)
   * Otherwise, use <track> elements from backend storeSubtitles (out-of-band)
   */
  const useTrackElements = subtitleTracks.length === 0 && processedSubtitles.length > 0

  return (
    <div className="flex min-h-dvh flex-col bg-[#050507] text-white overflow-x-hidden relative">
      {/* Cinematic Ambient Glow behind the player */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl aspect-video pointer-events-none z-0 opacity-40 md:opacity-65"
        style={{
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(229, 9, 20, 0.12) 0%, rgba(0, 0, 0, 0) 100%)'
        }}
      />

      <header className="relative z-10 flex items-center justify-between gap-4 border-b border-white/5 bg-black/40 px-5 py-4 backdrop-blur-md sm:px-8">
        <button
          type="button"
          onClick={close}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white transition duration-200 cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
        <h1 className="truncate text-center font-display text-base font-black tracking-tight text-white sm:text-lg max-w-lg md:max-w-2xl inline-flex items-center justify-center gap-2">
          <span>{title}</span>
          {activePlayingProvider && (
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20 shadow-sm uppercase tracking-wider">
              Playing via {activePlayingProvider === 'vidsrc-sbs' ? 'VidSrc SBS' :
                           activePlayingProvider === 'peachify' ? 'Peachify' :
                           activePlayingProvider === 'streamimdb' ? 'StreamIMDb' :
                           activePlayingProvider === 'autoembed' ? 'AutoEmbed' :
                           activePlayingProvider === 'embedsu' ? 'EmbedSU' :
                           activePlayingProvider === 'vidsrc' ? 'VidSrc' : activePlayingProvider}
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={close}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 hover:border-white/20 hover:bg-white/10 hover:text-white transition duration-200 cursor-pointer"
          aria-label="Close player"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </header>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5 px-4 py-4 md:py-6">
        {urlOverride && (
          <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-3.5 text-xs text-white/70 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-white">Debug URL Override Enabled</span>
              <span className="text-white/40 font-medium">Add `?debug=1` to log HLS events</span>
            </div>
            <div className="mt-2 break-all font-mono text-[11px] text-white/50">{urlOverride}</div>
          </div>
        )}

        {/* ── Settings Bar: Quality + Audio/Subtitle Settings ── */}
        {streamType !== 'embed' && (
          <div className="flex w-full max-w-6xl items-center justify-end gap-3">
            {/* Audio/Subtitle track info badges */}
            {audioTracks.length > 0 && (
              <div className="hidden items-center gap-1.5 rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-[11px] font-bold text-white/70 backdrop-blur-md sm:inline-flex">
                <span className="text-blue-400">🔊</span>
                <span>{audioTracks.length} Audio Tracks</span>
                {subtitleTracks.length > 0 && (
                  <>
                    <span className="text-white/10">|</span>
                    <span className="text-emerald-400">CC</span>
                    <span>{subtitleTracks.length} Subtitles</span>
                  </>
                )}
              </div>
            )}

            <PlayerSettingsPanel
              audioTracks={audioTracks}
              selectedAudioTrackId={selectedAudioTrackId}
              onAudioTrackChange={handleAudioTrackChange}
              subtitleTracks={effectiveSubtitleTracks}
              selectedSubtitleTrackId={selectedSubtitleTrackId}
              onSubtitleTrackChange={handleSubtitleTrackChange}
              qualityOptions={qualityOptions}
              selectedQuality={selectedQuality}
              onQualityChange={handleQualityChange}
              variants={variants}
              selectedVariantId={selectedVariantId}
              onVariantChange={handleVariantChange}
            />
          </div>
        )}

        <div className="relative flex aspect-video max-h-[calc(100dvh-240px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#070709] shadow-[0_0_80px_rgba(229,9,20,0.18)]">
          {playbackError ? (
            <div className="flex flex-col items-center justify-center gap-4 bg-black/60 backdrop-blur-md p-6 text-center w-full h-full">
              <AlertCircle className="h-10 w-10 text-mz-primary" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-white">Playback Error</p>
                <p className="text-xs text-mz-secondary">{playbackError}</p>
              </div>
              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  disabled={refreshing}
                  onClick={handleRefreshStream}
                  className="btn-primary px-5 py-3 text-xs"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing Link…' : 'Refresh Stream Connection'}
                </button>
                <button
                  type="button"
                  onClick={close}
                  className="btn-secondary px-5 py-3 text-xs"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : (
            <>
              {(showVideoPlaceholder || statusMessage) && (
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6">
                  <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-xl">
                    <h3 className="text-center font-display text-base font-bold text-white tracking-wide mb-5">
                      {statusMessage || "Searching for the best streaming source..."}
                    </h3>
                    
                    <div className="space-y-3">
                      {providerStates.map((prov) => {
                        const isWaiting = prov.status === 'WAITING'
                        const isTrying = prov.status === 'TRYING'
                        const isSuccess = prov.status === 'SUCCESS'
                        const isFailed = prov.status === 'FAILED'
                        const isSkipped = prov.status === 'SKIPPED'

                        return (
                          <div
                            key={prov.name}
                            className={[
                              'flex items-center justify-between rounded-xl border p-3.5 transition-all duration-300',
                              isWaiting ? 'border-white/5 bg-white/[0.01] opacity-40' : '',
                              isTrying ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)] scale-[1.02] font-semibold text-amber-300' : '',
                              isSuccess ? 'border-emerald-500/40 bg-emerald-500/5 shadow-[0_0_15px_rgba(16,185,129,0.15)] text-emerald-400 font-bold' : '',
                              isFailed ? 'border-red-500/30 bg-red-500/5 text-red-400 opacity-80' : '',
                              isSkipped ? 'border-white/5 bg-white/[0.01] opacity-30 text-white/50' : '',
                            ].join(' ')}
                          >
                            <div className="flex items-center gap-3">
                              {isWaiting && <div className="h-4 w-4 rounded-full border-2 border-white/20" />}
                              {isTrying && <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />}
                              {isSuccess && (
                                <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l5-5z" clipRule="evenodd" />
                                </svg>
                              )}
                              {isFailed && (
                                <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                              )}
                              {isSkipped && (
                                <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                                </svg>
                              )}
                              <span className="text-sm tracking-wide">{prov.displayName}</span>
                            </div>
                            
                            <span className="text-2xs font-extrabold uppercase tracking-widest opacity-80">
                              {isWaiting && "Waiting"}
                              {isTrying && "Trying..."}
                              {isSuccess && "Connected"}
                              {isFailed && (prov.reason || "Failed")}
                              {isSkipped && "Offline"}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {streamType === 'embed' && activeEmbedUrl ? (
                <div className="relative h-full w-full">
                  <iframe
                    src={activeEmbedUrl}
                    className="h-full w-full border-0 bg-black"
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  />
                  
                  {/* Source switcher toolbar — shown only when multiple embed sources are available */}
                  {allEmbedSources.length > 1 && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2.5 rounded-2xl border border-white/5 bg-black/85 backdrop-blur-xl px-4 py-2 shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none">
                      <span className="text-[10px] font-extrabold text-white/35 uppercase tracking-widest mr-1.5">Source</span>
                      {allEmbedSources.map((src, idx) => {
                        const srcHost = (() => {
                          try {
                            const host = new URL(src).hostname.replace('www.', '').toLowerCase()
                            if (host.includes('vidsrc.sbs')) return 'VidSrc SBS'
                            if (host.includes('vidsrc-embed.ru')) return 'VidSrc (RU)'
                            if (host.includes('vidsrc-embed.su')) return 'VidSrc (SU)'
                            if (host.includes('vsembed.su')) return 'VidSrc (VS)'
                            if (host.includes('vidsrc.me')) return 'VidSrc (.me)'
                            if (host.includes('vidsrc.to')) return 'VidSrc (.to)'
                            if (host.includes('vidsrc.xyz')) return 'VidSrc (.xyz)'
                            if (host.includes('peachify') || host.includes('eat-peach')) return 'Peachify'
                            if (host.includes('streamimdb') || host.includes('streamdata') || host.includes('vaplayer')) return 'StreamIMDb'
                            if (host.includes('autoembed')) return 'AutoEmbed'
                            if (host.includes('embed.su') || host.includes('embedsu')) return 'EmbedSU'
                            if (host.includes('vidsrc')) return 'VidSrc'
 
                            const parts = host.split('.')
                            const name = parts.length > 1 ? parts[parts.length - 2] : host
                            return name.charAt(0).toUpperCase() + name.slice(1)
                          } catch {
                            return `Server ${idx + 1}`
                          }
                        })()
                        const isActive = idx === embedFallbackIndex
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { setEmbedFallbackIndex(idx) }}
                            className={`
                              rounded-lg px-3 py-1.5 text-[10px] font-extrabold transition-all duration-300 cursor-pointer
                              ${isActive
                                ? 'bg-mz-primary text-white shadow-[0_4px_16px_rgba(229,9,20,0.35)] scale-100'
                                : 'text-white/50 hover:bg-white/5 hover:text-white hover:scale-[1.02] active:scale-[0.98]'
                              }
                            `}
                          >
                            {srcHost}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <video
                  ref={videoRef}
                  key={`${streamUrl}_${videoKey}`}
                  controls
                  autoPlay
                  playsInline
                  preload="auto"
                  className={`h-full w-full bg-black object-contain ${statusMessage ? 'invisible' : ''}`}
                >
                  {/* Backend subtitles as <track> elements (fallback when HLS.js has no embedded subs) */}
                  {useTrackElements &&
                    processedSubtitles.map((sub, idx) => (
                      <track
                        key={idx}
                        kind={sub.kind || 'subtitles'}
                        label={sub.label}
                        srcLang={sub.language}
                        src={sub.url}
                      />
                    ))}
                </video>
              )}
            </>
          )}
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/5 bg-black/20 py-4 text-center text-xs font-semibold text-mz-secondary/60">
        <Link to={paths.home} className="hover:text-white transition duration-200">
          Return to MovieZon Home
        </Link>
      </footer>
    </div>
  )
}
