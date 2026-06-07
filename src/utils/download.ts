export function sanitizeFilename(name: string): string {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim() || 'moviezon-video'
}

export function buildDownloadFilename(
  title: string,
  resolution: number,
  season?: number,
  episode?: number,
): string {
  const base = sanitizeFilename(title)
  if (season != null && episode != null) {
    return `${base}_S${season}E${episode}_${resolution}p.mp4`
  }
  return `${base}_${resolution}p.mp4`
}

function saveBlobAsFile(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000)
}

export interface DownloadProgressOptions {
  onProgress?: (progress: number) => void
  signal?: AbortSignal
  onExpired?: () => Promise<string>
}

export type DownloadTarget = 'device' | 'offline'

/** 2 MiB chunks — same pattern as video player Range requests (206). */
const RANGE_CHUNK_SIZE = 2 * 1024 * 1024



function parseContentRangeTotal(header: string | null): number | null {
  if (!header) return null
  const match = header.match(/\/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

function downloadHttpError(status: number): Error {
  return new Error(`Download failed (${status})`)
}

async function probeTotalBytes(
  url: string,
  signal?: AbortSignal,
): Promise<number | null> {
  const res = await fetch(url, {
    signal,
    headers: { Range: 'bytes=0-0' },
  })

  if (res.status === 206) {
    const total = parseContentRangeTotal(res.headers.get('Content-Range'))
    await res.arrayBuffer()
    return total
  }

  if (res.ok) {
    const len = Number(res.headers.get('Content-Length') || 0)
    if (len > 0) {
      await res.arrayBuffer()
      return len
    }
  }

  if (res.status === 403 || res.status === 401) {
    throw downloadHttpError(res.status)
  }

  return null
}

async function fetchRangeChunk(
  url: string,
  start: number,
  end: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  const res = await fetch(url, {
    signal,
    headers: { Range: `bytes=${start}-${end}` },
  })
  if (res.status !== 206 && res.status !== 200) {
    throw downloadHttpError(res.status)
  }
  return new Uint8Array(await res.arrayBuffer())
}

function isM3u8Url(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.pathname.endsWith('.m3u8') || parsed.searchParams.get('u')?.includes('.m3u8') || false
  } catch {
    return url.includes('.m3u8')
  }
}

async function parsePlaylistSegments(playlistUrl: string, signal?: AbortSignal): Promise<string[]> {
  const res = await fetch(playlistUrl, { signal })
  if (!res.ok) throw new Error(`Failed to fetch playlist (${res.status})`)
  const text = await res.text()
  
  if (text.includes('#EXT-X-STREAM-INF')) {
    // Master playlist, find the best variant
    const lines = text.split(/\r?\n/)
    let bestUrl: string | null = null
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (line && !line.startsWith('#')) {
        bestUrl = new URL(line, playlistUrl).toString()
        break
      }
    }
    if (!bestUrl) throw new Error('No variants found in master playlist')
    return parsePlaylistSegments(bestUrl, signal)
  }
  
  const lines = text.split(/\r?\n/)
  const segmentUrls: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line && !line.startsWith('#')) {
      segmentUrls.push(new URL(line, playlistUrl).toString())
    }
  }
  return segmentUrls
}

async function downloadHlsSegments(
  playlistUrl: string,
  options: DownloadProgressOptions,
): Promise<Blob> {
  const segmentUrls = await parsePlaylistSegments(playlistUrl, options.signal)
  if (segmentUrls.length === 0) {
    throw new Error('No video segments found in the playlist')
  }
  
  const chunks: BlobPart[] = new Array(segmentUrls.length)
  let completed = 0
  const CONCURRENCY = 6
  
  const downloadSegment = async (index: number) => {
    const segUrl = segmentUrls[index]
    let response: Response | null = null
    let retries = 3
    while (retries > 0) {
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        response = await fetch(segUrl, { signal: options.signal })
        if (response.ok) break
      } catch (err) {
        if (options.signal?.aborted) throw err
      }
      retries--
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    if (!response || !response.ok) {
      throw new Error(`Failed to fetch segment after retries (${response?.status || 'network error'})`)
    }
    
    const buffer = await response.arrayBuffer()
    chunks[index] = new Uint8Array(buffer)
    completed++
    options.onProgress?.(Math.min(100, Math.round((completed / segmentUrls.length) * 100)))
  }
  
  const pool = Array.from({ length: CONCURRENCY }, async (_, workerId) => {
    for (let i = workerId; i < segmentUrls.length; i += CONCURRENCY) {
      await downloadSegment(i)
    }
  })
  
  await Promise.all(pool)
  return new Blob(chunks, { type: 'video/mp4' })
}

/**
 * CDN allows Range streaming (206) for playback but blocks full-file GET (403).
 * Download in chunks through the backend proxy, same as the video element.
 */
async function readFullViaRanges(
  url: string,
  options: DownloadProgressOptions,
): Promise<Blob> {
  if (isM3u8Url(url)) {
    return downloadHlsSegments(url, options)
  }

  const total = await probeTotalBytes(url, options.signal)
  if (total == null || total <= 0) {
    const res = await fetch(url, { signal: options.signal })
    if (!res.ok) throw downloadHttpError(res.status)
    return readResponseAsBlob(res, options)
  }

  const chunks: BlobPart[] = []
  let received = 0
  let start = 0
  let currentUrl = url

  while (start < total) {
    if (options.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    const end = Math.min(start + RANGE_CHUNK_SIZE - 1, total - 1)

    let chunk: Uint8Array | null = null
    let chunkRetries = 3
    let lastError: any = null

    while (chunkRetries > 0) {
      try {
        chunk = await fetchRangeChunk(currentUrl, start, end, options.signal)
        break
      } catch (err) {
        if (options.signal?.aborted) throw err
        lastError = err
        chunkRetries--
        if (chunkRetries > 0) {
          await new Promise((r) => setTimeout(r, 1500))
        }
      }
    }

    if (!chunk) {
      // Chunk download failed after 3 attempts. Try to refresh the URL and retry.
      if (options.onExpired) {
        try {
          console.warn('[Download] Chunk download failed. Refreshing signed URL...')
          currentUrl = await options.onExpired()
          // Retry chunk with the fresh URL
          chunk = await fetchRangeChunk(currentUrl, start, end, options.signal)
        } catch (retryErr) {
          throw lastError || retryErr
        }
      } else {
        throw lastError || new Error('Failed to fetch range chunk after retries')
      }
    }

    chunks.push(chunk as BlobPart)
    received += chunk.byteLength
    start = end + 1
    options.onProgress?.(Math.min(100, Math.round((received / total) * 100)))
  }

  options.onProgress?.(100)
  return new Blob(chunks, { type: 'video/mp4' })
}



async function readResponseAsBlob(
  response: Response,
  options: DownloadProgressOptions,
): Promise<Blob> {
  const type = response.headers.get('Content-Type') || 'video/mp4'
  const reader = response.body?.getReader()

  if (!reader) {
    const blob = await response.blob()
    options.onProgress?.(100)
    return blob
  }

  const chunks: BlobPart[] = []
  const total = Number(response.headers.get('Content-Length') || 0)
  let received = 0

  while (true) {
    if (options.signal?.aborted) {
      reader.cancel()
      throw new DOMException('Aborted', 'AbortError')
    }
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      if (total > 0) {
        options.onProgress?.(Math.min(100, Math.round((received / total) * 100)))
      }
    }
  }

  options.onProgress?.(100)
  return new Blob(chunks, { type })
}

/**
 * Download MP4 via backend proxy using Range chunks (playback-compatible).
 */
export async function downloadStreamToFile(
  url: string,
  filename: string,
  options: DownloadProgressOptions & { target?: DownloadTarget } = {},
): Promise<Blob> {
  const target = options.target ?? 'device'
  const blob = await readFullViaRanges(url, options)

  if (target === 'device') {
    saveBlobAsFile(blob, filename)
  }

  return blob
}

/** Offline storage: ranged download → Blob (no full-file GET). */
export async function fetchVideoBlobForDownload(
  url: string,
  options: DownloadProgressOptions = {},
): Promise<Blob> {
  return readFullViaRanges(url, options)
}
