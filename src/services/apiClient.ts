import { API_BASE_URL } from '@/core/config/env'

/** In-memory cache + in-flight dedupe + 429 retry — reduces rate-limit errors */

export class ApiHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Request failed (${status})`)
    this.name = 'ApiHttpError'
    this.status = status
  }
}

interface CacheEntry {
  data: unknown
  expires: number
}

const memoryCache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const SESSION_PREFIX = 'moviezon-api:'

function readSession<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(SESSION_PREFIX + key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data: T; expires: number }
    if (parsed.expires <= Date.now()) {
      sessionStorage.removeItem(SESSION_PREFIX + key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function writeSession(key: string, data: unknown, expires: number) {
  try {
    sessionStorage.setItem(
      SESSION_PREFIX + key,
      JSON.stringify({ data, expires }),
    )
  } catch {
    /* quota or private mode */
  }
}

function getCached<T>(key: string, allowStale = false): T | null {
  const mem = memoryCache.get(key)
  if (mem) {
    if (mem.expires > Date.now()) return mem.data as T
    if (allowStale) return mem.data as T
  }
  const session = readSession<T>(key)
  if (session) {
    memoryCache.set(key, { data: session, expires: Date.now() + 60_000 })
    return session
  }
  return null
}

function setCached(
  key: string,
  data: unknown,
  ttlMs: number,
  persist: boolean,
) {
  const expires = Date.now() + ttlMs
  memoryCache.set(key, { data, expires })
  if (persist) writeSession(key, data, expires)
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null
  const seconds = Number(header)
  if (!Number.isNaN(seconds)) return Math.max(seconds, 1) * 1000
  const date = Date.parse(header)
  if (!Number.isNaN(date)) return Math.max(date - Date.now(), 1000)
  return null
}

export interface FetchJsonOptions {
  /** Cache lifetime; 0 = no cache write */
  ttlMs?: number
  /** Bypass cache read (still dedupes in-flight) */
  skipCache?: boolean
  /** Max retries after 429 */
  retries?: number
  /** Persist in sessionStorage for the TTL */
  persist?: boolean
  /** AbortSignal — when fired the request is immediately cancelled */
  signal?: AbortSignal
}

export async function fetchJson<T>(
  url: string,
  options: FetchJsonOptions = {},
): Promise<T> {
  const {
    ttlMs = 60_000,
    skipCache = false,
    retries = 2,
    persist = false,
    signal,
  } = options

  // Bail early if already aborted before we even start
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const cacheKey = url

  if (!skipCache) {
    const hit = getCached<T>(cacheKey)
    if (hit) return hit
  }

  // For abortable requests we skip in-flight dedup (each caller gets its own
  // cancellable promise so one abort doesn't cancel a sibling's fetch).
  const existing = signal ? null : inflight.get(cacheKey)
  if (existing) return existing as Promise<T>

  const run = async (): Promise<T> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      // Re-check abort between retry attempts
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal,
      })

      if (res.status === 429 || res.status === 502 || res.status === 503) {
        const stale = getCached<T>(cacheKey, true)
        if (stale) return stale

        if (attempt < retries) {
          const wait =
            parseRetryAfterMs(res.headers.get('Retry-After')) ??
            (res.status === 429
              ? Math.min(1500 * 2 ** attempt, 10_000)
              : 4000)
          await new Promise((r) => setTimeout(r, wait))
          continue
        }

        const message =
          res.status === 429
            ? 'Catalog is busy (too many requests). Wait a minute, then retry.'
            : 'Service temporarily unavailable. Please try again in a few seconds.'
        throw new ApiHttpError(res.status, message)
      }

      if (!res.ok) {
        throw new ApiHttpError(res.status)
      }

      const data = (await res.json()) as T
      if (ttlMs > 0) setCached(cacheKey, data, ttlMs, persist)
      return data
    }

    throw new ApiHttpError(429)
  }

  if (signal) {
    // Abortable path — not stored in inflight map (each call is independent)
    return run()
  }

  const promise = run().finally(() => {
    inflight.delete(cacheKey)
  })

  inflight.set(cacheKey, promise)
  return promise
}

export function buildApiUrl(
  path: string,
  params?: Record<string, string>,
): string {
  // When API_BASE_URL is empty (Vite proxy mode) use the current page origin
  // so new URL() doesn't throw a TypeError on an empty base string.
  const base = API_BASE_URL || window.location.origin
  const url = new URL(path, base)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }
  return url.toString()
}
