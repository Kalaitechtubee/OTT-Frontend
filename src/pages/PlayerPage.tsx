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
          // This is the deterministic path — NetMirror first, Peachify on fallback.
          let tmdbTarget = id || tmdbIdParam || ''
          const tvMatch = String(tmdbTarget).match(/^(\d+)[-:](\d+)[-:](\d+)$/)
          let season = seasonParam ? parseInt(seasonParam, 10) : undefined
          let episode = episodeParam ? parseInt(episodeParam, 10) : undefined
          if (tvMatch) {
            tmdbTarget = tvMatch[1]
            if (season === undefined) season = parseInt(tvMatch[2], 10)
            if (episode === undefined) episode = parseInt(tvMatch[3], 10)
          }
          res = await resolveStream(tmdbTarget, mediaTypeParam, season, episode, dubParam)
        } else {
          // Explicit provider: user manually selected a server (e.g. tapped 'Server 2').
          // Route directly to that provider — no pipeline involved.
          res = await getStreamV2(provider as any, id, sourcesList, dubParam)
        }

        if (!active) return

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
            { provider: res.selectedProvider || provider!, id },
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
            res.embedFallbacks || []
          )
        } else if (res.streams && res.streams.length > 0) {
          play(
            titleParam,
            posterParam,
            { provider: res.selectedProvider || provider!, id },
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
            activeSelectedVariantId
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
    if (rawActiveEmbedUrl.includes('peachify.top') || rawActiveEmbedUrl.includes('eat-peach.sbs')) {
      try {
        const urlObj = new URL(rawActiveEmbedUrl)
        urlObj.searchParams.set('accent', primaryColorHex)
        return urlObj.toString()
      } catch {
        const separator = rawActiveEmbedUrl.includes('?') ? '&' : '?'
        return `${rawActiveEmbedUrl}${separator}accent=${primaryColorHex}`
      }
    }
    return rawActiveEmbedUrl
  }, [rawActiveEmbedUrl, primaryColorHex])



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
        <h1 className="truncate text-center font-display text-base font-black tracking-tight text-white sm:text-lg max-w-lg md:max-w-2xl">
          {title}
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
                <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-md">
                  <RefreshCw className="h-10 w-10 animate-spin text-mz-primary" />
                  <p className="text-sm font-bold text-white">
                    {statusMessage || 'Resolving Stream...'}
                  </p>
                </div>
              )}
              {streamType === 'embed' ? (
                <div className="relative h-full w-full bg-black">
                  <iframe
                    key={`embed_${embedFallbackIndex}`}
                    src={activeEmbedUrl || undefined}
                    className={`h-full w-full border-none ${statusMessage ? 'invisible' : ''}`}
                    allow="autoplay; fullscreen; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="no-referrer"
                    sandbox={activeEmbedUrl.includes('peachify') ? undefined : "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"}
                  />
                  {/* Source switcher toolbar — shown only when multiple embed sources are available */}
                  {allEmbedSources.length > 1 && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-md px-4 py-2 shadow-xl">
                      <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mr-1">Source</span>
                      {allEmbedSources.map((src, idx) => {
                        const srcHost = (() => {
                          try {
                            const host = new URL(src).hostname.replace('www.', '').toLowerCase()
                            if (host.includes('peachify') || host.includes('eat-peach')) return 'Peachify'
                            if (host.includes('vidsrc')) return 'VidSrc'
                            if (host.includes('autoembed')) return 'AutoEmbed'
                            if (host.includes('embed.su')) return 'EmbedSU'

                            const parts = host.split('.')
                            const name = parts.length > 1 ? parts[parts.length - 2] : host
                            return name.charAt(0).toUpperCase() + name.slice(1)
                          } catch {
                            return `Server ${idx + 1}`
                          }
                        })()
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => { setEmbedFallbackIndex(idx) }}
                            className={`rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all duration-200 cursor-pointer ${idx === embedFallbackIndex
                                ? 'bg-mz-primary text-white shadow-[0_0_12px_rgba(229,9,20,0.4)]'
                                : 'text-white/60 hover:bg-white/10 hover:text-white'
                              }`}
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
