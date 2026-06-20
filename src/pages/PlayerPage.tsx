import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, X, AlertCircle, RefreshCw } from 'lucide-react'
import Hls from 'hls.js'
import {
  PlayerSettingsPanel,
  type AudioTrackInfo,
  type SubtitleTrackInfo,
} from '@/components/common/PlayerSettingsPanel'
import { usePlayerStore } from '@/store/playerStore'
import { useHistoryStore } from '@/store/historyStore'
import { paths } from '@/routes/paths'
import { getStreamV2 } from '@/services/api'
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
  const [searchParams] = useSearchParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const resumeTimeRef = useRef(0)

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

  /* ── Audio / Subtitle / Quality state ── */
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([])
  const [selectedAudioTrackId, setSelectedAudioTrackId] = useState(-1)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackInfo[]>([])
  const [selectedSubtitleTrackId, setSelectedSubtitleTrackId] = useState(-1) // -1 = off
  const hasAutoSelectedAudioRef = useRef(false)

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
  } = usePlayerStore()
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
      const freshResult = await getStreamV2(
        playContext.provider as Provider,
        playContext.id,
      )
      const freshStreams = freshResult.streams
      if (!freshStreams.length) return false

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
    if (!effectiveStreamUrl) {
      navigate(paths.home, { replace: true })
    }
  }, [effectiveStreamUrl, navigate])

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

    video.addEventListener('timeupdate', onTime)
    return () => {
      video.removeEventListener('timeupdate', onTime)
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
          const sub = processedSubtitles[trackId]
          selectedSubtitleLanguageRef.current = sub ? (sub.language || null) : null
          console.log('[Subtitles] Selected subtitle url:', sub ? sub.url : 'none')
        }
      }
    },
    [processedSubtitles],
  )

  /* ─── Quality change handler ─── */
  const handleQualityChange = useCallback(
    (value: string) => {
      const stream = streams.find((item) => item.quality === value)
      if (!stream || stream.url === streamUrl) return

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

  if (!effectiveStreamUrl) return null

  const close = () => {
    stop()
    if (playContext) {
      navigate(paths.detail(playContext.provider, playContext.id))
    } else {
      navigate(paths.home)
    }
  }

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
            />
          </div>
        )}

        <div className="relative flex aspect-video max-h-[calc(100dvh-240px)] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-[#070709] shadow-[0_0_80px_rgba(229,9,20,0.18)]">
          {statusMessage && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-md px-4 text-center animate-fade-in">
              <div className="mb-4 flex h-14 w-14 animate-spin items-center justify-center rounded-full bg-mz-primary/15 border border-mz-primary/20 text-mz-primary shadow-[0_0_15px_rgba(229,9,20,0.25)]">
                <RefreshCw className="h-6 w-6" />
              </div>
              <p className="text-sm font-bold text-white tracking-wide">
                {statusMessage}
              </p>
            </div>
          )}

          {playbackError ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-black/60 backdrop-blur-md px-6 py-12 text-center animate-fade-in">
              <div className="mb-4 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-mz-error/15 border border-mz-error/25 text-mz-error shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                <AlertCircle className="h-8 w-8" />
              </div>
              <h3 className="font-display text-xl font-black text-white">Playback Error</h3>
              <p className="mt-2 max-w-md text-sm font-medium text-mz-secondary/90 leading-relaxed">
                {playbackError}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
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
          ) : streamType === 'embed' ? (
            <iframe
              src={embedUrl || effectiveStreamUrl}
              className={`h-full w-full bg-black border-none ${statusMessage ? 'invisible' : ''}`}
              allow="autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
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
