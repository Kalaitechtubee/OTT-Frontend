import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getDownloadV2, resolveDownload } from '@/services/api'
import {
  buildDownloadFilename,
  fetchVideoBlobForDownload,
} from '@/utils/download'
import { deleteOfflineVideo, saveOfflineVideo } from '@/utils/offlineStorage'
import {
  type DownloadRefererContext,
  toDownloadFetchUrl,
} from '@/utils/streamDownload'

export interface DownloadItem {
  downloadId: string
  tmdbId: number
  title: string
  type: 'movie' | 'tv'
  posterPath?: string
  season?: number
  episode?: number
  resolution: number
  language: string
  progress: number
  status: 'downloading' | 'completed' | 'failed' | 'cancelled'
  isOffline: boolean
}

interface StartDownloadParams {
  tmdbId: number
  title: string
  type: 'movie' | 'tv'
  posterPath?: string
  season?: number
  episode?: number
  resolution: number
  quality?: string
  language: string
  isOffline: boolean
  provider?: string
  id?: string
  sid?: string
  dp?: string
  dub?: string
  url?: string
}

interface DownloadState {
  items: DownloadItem[]
  startDownload: (params: StartDownloadParams) => Promise<boolean>
  cancelDownload: (downloadId: string) => void
  deleteDownload: (downloadId: string) => Promise<void>
}

const abortControllers = new Map<string, AbortController>()

function makeDownloadId(params: StartDownloadParams): string {
  if (params.provider && params.id) {
    return `${params.provider}-${params.id}-${params.resolution}p-${params.isOffline ? 'offline' : 'device'}`
  }
  if (params.type === 'tv' && params.season != null && params.episode != null) {
    return `${params.tmdbId}-s${params.season}e${params.episode}-${params.resolution}p-${params.isOffline ? 'offline' : 'device'}`
  }
  return `${params.tmdbId}-${params.resolution}p-${params.isOffline ? 'offline' : 'device'}`
}

async function fetchFreshDownloadUrl(
  params: StartDownloadParams,
): Promise<string> {
  if (params.url) {
    return params.url
  }
  if (params.provider && params.id) {
    let result
    if (params.provider === 'tmdb') {
      result = await resolveDownload(
        params.id,
        params.type,
        params.season,
        params.episode,
        params.dub
      )
    } else {
      result = await getDownloadV2(
        params.provider,
        params.id,
        params.season,
        params.episode,
        params.dub
      )
    }
    const streams = result.streams
    if (!streams || !streams.length) {
      throw new Error('No download streams available')
    }
    // Find matching quality (try exact quality label match first, then fallback to resolution number)
    const match = (params.quality ? streams.find((s) => s.quality === params.quality) : null) ||
                  streams.find((s) => s.quality.includes(String(params.resolution))) ||
                  streams[0]
    if (!match) throw new Error('Selected quality is unavailable')
    return match.url
  }
  throw new Error('Provider and ID are required for V2 download')
}

export const useDownloadStore = create<DownloadState>()(
  persist(
    (set, get) => ({
      items: [],

      startDownload: async (params) => {
        const downloadId = makeDownloadId(params)
        const existing = get().items.find((d) => d.downloadId === downloadId)
        if (
          existing &&
          (existing.status === 'downloading' || existing.status === 'completed')
        ) {
          return existing.status === 'completed'
        }

        const controller = new AbortController()
        abortControllers.set(downloadId, controller)

        const baseItem: DownloadItem = {
          downloadId,
          tmdbId: params.tmdbId,
          title: params.title,
          type: params.type,
          posterPath: params.posterPath,
          season: params.season,
          episode: params.episode,
          resolution: params.resolution,
          language: params.language,
          progress: 0,
          status: 'downloading',
          isOffline: params.isOffline,
        }

        set({
          items: [
            baseItem,
            ...get().items.filter((d) => d.downloadId !== downloadId),
          ],
        })

        const onProgress = (progress: number) => {
          set({
            items: get().items.map((item) =>
              item.downloadId === downloadId
                ? { ...item, progress, status: 'downloading' }
                : item,
            ),
          })
        }

        try {
          let url = await fetchFreshDownloadUrl(params)
          const filename = buildDownloadFilename(
            params.title,
            params.resolution,
            params.season,
            params.episode,
          )

          const refererCtx: DownloadRefererContext = {
            tmdbId: params.tmdbId,
            type: params.type,
            season: params.season,
            episode: params.episode,
            sid: params.sid,
            dp: params.dp,
            dub: params.dub,
          }

          const onExpired = async () => {
            const freshUrl = await fetchFreshDownloadUrl(params)
            return toDownloadFetchUrl(freshUrl, refererCtx)
          }

          const run = async (streamUrl: string) => {
            const fetchUrl = toDownloadFetchUrl(streamUrl, refererCtx)
            if (import.meta.env.DEV) {
              console.debug('[Download] URL =>', fetchUrl)
            }

            if (params.isOffline) {
              const blob = await fetchVideoBlobForDownload(fetchUrl, {
                signal: controller.signal,
                onProgress,
                onExpired,
              })
              await saveOfflineVideo(downloadId, blob)
              return
            }

            // Direct native browser download via backend proxy
            const downloadUrl = `${fetchUrl}&download=true&filename=${encodeURIComponent(filename)}`
            const anchor = document.createElement('a')
            anchor.href = downloadUrl
            anchor.download = filename
            anchor.style.display = 'none'
            document.body.appendChild(anchor)
            anchor.click()
            anchor.remove()
            
            // Mark progress as 100% since browser native downloader takes over
            onProgress(100)
          }

          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              if (attempt > 0) {
                url = await fetchFreshDownloadUrl(params)
              }
              await run(url)
              break
            } catch (err) {
              // Any error (network drop, signature timeout, etc.) is retryable in the outer loop
              if (attempt === 1) {
                throw err
              }
            }
          }

          set({
            items: get().items.map((item) =>
              item.downloadId === downloadId
                ? { ...item, progress: 100, status: 'completed' }
                : item,
            ),
          })
          return true
        } catch (err) {
          console.error('[Download] Failed:', err)
          const cancelled =
            err instanceof DOMException && err.name === 'AbortError'
          set({
            items: get().items.map((item) =>
              item.downloadId === downloadId
                ? {
                    ...item,
                    progress: 0,
                    status: cancelled ? 'cancelled' : 'failed',
                  }
                : item,
            ),
          })
          return false
        } finally {
          abortControllers.delete(downloadId)
        }
      },

      cancelDownload: (downloadId) => {
        abortControllers.get(downloadId)?.abort()
        abortControllers.delete(downloadId)
        set({
          items: get().items.map((item) =>
            item.downloadId === downloadId
              ? { ...item, progress: 0, status: 'cancelled' }
              : item,
          ),
        })
      },

      deleteDownload: async (downloadId) => {
        get().cancelDownload(downloadId)
        const item = get().items.find((d) => d.downloadId === downloadId)
        if (item?.isOffline) {
          await deleteOfflineVideo(downloadId)
        }
        set({
          items: get().items.filter((d) => d.downloadId !== downloadId),
        })
      },
    }),
    { name: 'moviezon-downloads' },
  ),
)
