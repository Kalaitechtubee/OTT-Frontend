import { create } from 'zustand'
import type { V2Stream, V2Subtitle } from '@/types/v2'
import { parseV2Quality } from '@/types/v2'

/** Minimal stream context for player recovery in V2 */
export interface PlayContext {
  provider: string
  id: string
}

export interface StreamQualityItem {
  quality: string
  url: string
  resolution: number
}

export interface SubtitleItem {
  kind: string
  label: string
  language: string
  url: string
}

function toQualityItems(streams: V2Stream[]): StreamQualityItem[] {
  return streams.map((s) => ({
    quality: s.quality,
    url: s.url,
    resolution: parseV2Quality(s.quality),
  }))
}

interface PlayerState {
  /** The content title (for display in header) */
  title: string | null
  /** The poster URL (for display) */
  poster: string | null
  /** provider + id for stream recovery */
  playContext: PlayContext | null
  /** Currently active stream URL */
  streamUrl: string | null
  /** All available quality streams */
  streams: StreamQualityItem[]
  /** All available subtitle tracks */
  subtitles: SubtitleItem[]
  /** Currently selected quality label (e.g. "720p") */
  selectedQuality: string
  /** Playback progress 0-100 */
  progress: number
  /** TMDB ID of the current movie/show */
  tmdbId: string | null
  /** Media type (movie or tv) */
  mediaType: 'movie' | 'tv' | null
  /** Brief overview */
  overview: string | null
  /** Stream play type: embed, hls, or mp4 */
  streamType: 'embed' | 'hls' | 'mp4' | 'native' | null
  /** Embed URL if streamType is embed */
  embedUrl: string | null
  /** Ordered list of fallback embed URLs to try if primary embedUrl fails */
  embedFallbacks: string[]
  /** Audio variants (e.g. dubs) available for this stream */
  variants: { id: string; language: string }[]
  /** Currently selected audio variant ID */
  selectedVariantId: string | null

  play: (
    title: string,
    poster: string | null,
    context: PlayContext,
    streamUrl: string,
    streams: V2Stream[],
    quality: string,
    subtitles?: V2Subtitle[],
    tmdbId?: string | null,
    mediaType?: 'movie' | 'tv' | null,
    overview?: string | null,
    streamType?: 'embed' | 'hls' | 'mp4' | 'native' | null,
    embedUrl?: string | null,
    variants?: { id: string; language: string }[],
    selectedVariantId?: string | null,
    embedFallbacks?: string[]
  ) => void
  setStreamQuality: (streamUrl: string, quality: string, streams?: V2Stream[]) => void
  setStreamVariant: (
    streamUrl: string,
    selectedVariantId: string,
    quality: string,
    streams: V2Stream[],
    subtitles?: V2Subtitle[],
    streamType?: 'embed' | 'hls' | 'mp4' | 'native' | null,
    embedUrl?: string | null
  ) => void
  setProgress: (n: number) => void
  stop: () => void
}

export const usePlayerStore = create<PlayerState>((set) => ({
  title: null,
  poster: null,
  playContext: null,
  streamUrl: null,
  streams: [],
  subtitles: [],
  selectedQuality: '',
  progress: 0,
  tmdbId: null,
  mediaType: null,
  overview: null,
  streamType: null,
  embedUrl: null,
  embedFallbacks: [],
  variants: [],
  selectedVariantId: null,

  play: (
    title,
    poster,
    context,
    streamUrl,
    streams,
    quality,
    subtitles = [],
    tmdbId = null,
    mediaType = null,
    overview = null,
    streamType = null,
    embedUrl = null,
    variants = [],
    selectedVariantId = null,
    embedFallbacks = []
  ) =>
    set({
      title,
      poster,
      playContext: context,
      streamUrl,
      streams: toQualityItems(streams),
      subtitles,
      selectedQuality: quality,
      progress: 0,
      tmdbId,
      mediaType,
      overview,
      streamType,
      embedUrl,
      embedFallbacks,
      variants,
      selectedVariantId,
    }),

  setStreamQuality: (streamUrl, quality, streams) =>
    set((state) => ({
      streamUrl,
      selectedQuality: quality,
      streams: streams ? toQualityItems(streams) : state.streams,
    })),

  setStreamVariant: (streamUrl, selectedVariantId, quality, streams, subtitles = [], streamType = null, embedUrl = null) =>
    set((state) => ({
      streamUrl,
      selectedVariantId,
      selectedQuality: quality,
      streams: toQualityItems(streams),
      subtitles,
      streamType: streamType || (embedUrl ? 'embed' : 'hls'),
      embedUrl,
      playContext: state.playContext
        ? { ...state.playContext, id: selectedVariantId }
        : null,
    })),

  setProgress: (progress) => set({ progress }),

  stop: () =>
    set({
      title: null,
      poster: null,
      playContext: null,
      streamUrl: null,
      streams: [],
      subtitles: [],
      selectedQuality: '',
      progress: 0,
      tmdbId: null,
      mediaType: null,
      overview: null,
      streamType: null,
      embedUrl: null,
      embedFallbacks: [],
      variants: [],
      selectedVariantId: null,
    }),
}))
