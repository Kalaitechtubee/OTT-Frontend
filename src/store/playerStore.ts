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

  play: (
    title: string,
    poster: string | null,
    context: PlayContext,
    streamUrl: string,
    streams: V2Stream[],
    quality: string,
    subtitles?: V2Subtitle[]
  ) => void
  setStreamQuality: (streamUrl: string, quality: string, streams?: V2Stream[]) => void
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

  play: (title, poster, context, streamUrl, streams, quality, subtitles = []) =>
    set({
      title,
      poster,
      playContext: context,
      streamUrl,
      streams: toQualityItems(streams),
      subtitles,
      selectedQuality: quality,
      progress: 0,
    }),

  setStreamQuality: (streamUrl, quality, streams) =>
    set((state) => ({
      streamUrl,
      selectedQuality: quality,
      streams: streams ? toQualityItems(streams) : state.streams,
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
    }),
}))
