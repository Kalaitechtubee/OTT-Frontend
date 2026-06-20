import { API_BASE_URL } from '@/core/config/env'
import { urlForResolution, type StreamQuality } from '@/types/movie'

const CDN_HOST_PATTERN = /hakunaymatata|bcdnxw/i
const WORKER_PATTERN = /streamhub-proxy|workers\.dev/i
const NET27_ORIGIN = 'https://net27.cc'

export interface DownloadRefererContext {
  tmdbId: number
  type: 'movie' | 'tv'
  season?: number
  episode?: number
  sid?: string
  dp?: string
  dub?: string
}

export function isWorkerProxyUrl(url: string): boolean {
  return WORKER_PATTERN.test(url)
}

export function isDirectCdnUrl(url: string): boolean {
  try {
    return CDN_HOST_PATTERN.test(new URL(url).hostname)
  } catch {
    return false
  }
}

export function isBackendProxyUrl(url: string): boolean {
  try {
    return new URL(url).pathname.includes('/api/v2/stream/proxy')
  } catch {
    return false
  }
}

/** Prefer /cms/ MP4 paths — /resource/ URLs often 403 on full download. */
export function cdnPathScore(url: string): number {
  const lower = decodeURIComponent(url).toLowerCase()
  if (lower.includes('/cms/')) return 2
  if (lower.includes('/resource/')) return 0
  return 1
}

export function extractCdnUrl(streamUrl: string): string {
  if (isWorkerProxyUrl(streamUrl)) {
    return parseWorkerParams(streamUrl)?.cdnUrl ?? streamUrl
  }
  return streamUrl
}

export function buildEmbedReferer(ctx: DownloadRefererContext): string {
  const params: string[] = []
  if (ctx.type === 'tv') params.push('type=tv')
  if (ctx.season != null) params.push(`se=${ctx.season}`)
  if (ctx.episode != null) params.push(`ep=${ctx.episode}`)
  if (ctx.dub) params.push(`dub=${ctx.dub}`)
  if (ctx.sid) params.push(`sid=${ctx.sid}`)
  if (ctx.dp) params.push(`dp=${ctx.dp}`)
  const query = params.length ? `?${params.join('&')}` : ''
  return `${NET27_ORIGIN}/api/embed-tmdb/${ctx.tmdbId}${query}`
}

function parseWorkerParams(workerUrl: string): {
  cdnUrl: string
  referer?: string
  origin?: string
} | null {
  try {
    const parsed = new URL(workerUrl)
    const cdnUrl = parsed.searchParams.get('url')
    if (!cdnUrl) return null

    let referer = parsed.searchParams.get('referer') ?? undefined
    let origin = parsed.searchParams.get('origin') ?? undefined

    const headersParam = parsed.searchParams.get('headers')
    if (headersParam) {
      try {
        const headers = JSON.parse(headersParam)
        if (headers.referer) referer = headers.referer
        if (headers.Referer) referer = headers.Referer
        if (headers.origin) origin = headers.origin
        if (headers.Origin) origin = headers.Origin
      } catch (e) {
        console.warn('Failed to parse headers from worker url:', e)
      }
    }

    return {
      cdnUrl,
      referer,
      origin,
    }
  } catch {
    return null
  }
}

/**
 * Browser downloads cannot hit the CDN directly (403). CF Worker URLs work for
 * `<video>` but `fetch()` needs same-origin access — route via backend proxy.
 */
export function toDownloadFetchUrl(
  streamUrl: string,
  ctx?: DownloadRefererContext,
): string {
  if (isBackendProxyUrl(streamUrl)) {
    return streamUrl
  }

  let cdnUrl = streamUrl.trim()
  let referer: string | undefined
  let origin = NET27_ORIGIN

  if (isWorkerProxyUrl(streamUrl)) {
    const workerParams = parseWorkerParams(streamUrl)
    if (workerParams) {
      cdnUrl = workerParams.cdnUrl
      referer = workerParams.referer
      origin = workerParams.origin ?? origin
    }
  } else if (isDirectCdnUrl(streamUrl) && ctx) {
    referer = buildEmbedReferer(ctx)
  }

  const qs = new URLSearchParams({ url: cdnUrl })
  if (referer) qs.set('referer', referer)
  if (origin) qs.set('origin', origin)
  
  let baseUrl = API_BASE_URL ? API_BASE_URL.trim() : ''
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1)
  }
  return `${baseUrl}/api/v2/stream/proxy?${qs.toString()}`
}

/** Pick stream URL best suited for download (cms > other > resource). */
export function urlForDownload(
  streams: StreamQuality[],
  resolution: number,
  mp4?: string,
): string {
  const atResolution = streams.filter((s) => s.resolution === resolution)
  const pool = atResolution.length ? atResolution : streams
  const sorted = [...pool].sort(
    (a, b) =>
      cdnPathScore(extractCdnUrl(b.url)) - cdnPathScore(extractCdnUrl(a.url)),
  )
  const best = sorted[0]?.url?.trim()
  if (best) return best
  if (mp4?.trim()) {
    const mp4Url = mp4.trim()
    if (cdnPathScore(extractCdnUrl(mp4Url)) > 0) return mp4Url
  }
  return urlForResolution(streams, resolution, mp4)
}
