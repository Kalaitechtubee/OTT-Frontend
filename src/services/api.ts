import { API_BASE_URL } from '@/core/config/env'
import { ApiHttpError, buildApiUrl, fetchJson, getCached } from '@/services/apiClient'
import type { Provider, V2Details, V2SearchResult, V2StreamResult } from '@/types/v2'

export { ApiHttpError }

// ─── Cache TTLs ───────────────────────────────────────────────────────────────
const SEARCH_TTL_MS = 2 * 60 * 1000
const DETAIL_TTL_MS = 10 * 60 * 1000
const STREAM_TTL_MS = 0 // streams are always fresh (no cache)

// ─── Generic request helper ───────────────────────────────────────────────────
async function request<T>(
  path: string,
  params?: Record<string, string>,
  options?: {
    ttlMs?: number
    skipCache?: boolean
    persist?: boolean
    retries?: number
    signal?: AbortSignal
  },
): Promise<T | null> {
  const url = buildApiUrl(path, params)
  try {
    const data = await fetchJson<{ ok?: boolean; success?: boolean } & T>(url, {
      ttlMs: options?.ttlMs ?? 60_000,
      skipCache: options?.skipCache,
      persist: options?.persist,
      retries: options?.retries ?? 2,
      signal: options?.signal,
    })
    if (data.ok === false || data.success === false) return null
    return data as T
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    // Propagate abort errors so callers can distinguish cancellation
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    return null
  }
}

// ─── V2 Search ────────────────────────────────────────────────────────────────
export async function searchV2(
  query: string,
  options?: { force?: boolean; signal?: AbortSignal },
): Promise<V2SearchResult[]> {
  try {
    const data = await request<{ success: boolean; count: number; results: V2SearchResult[] }>(
      '/api/v2/search',
      { q: query },
      { ttlMs: SEARCH_TTL_MS, skipCache: options?.force, signal: options?.signal },
    )
    return data?.results ?? []
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    // Silently ignore aborts — the caller's cleanup handler fired
    if (err instanceof DOMException && err.name === 'AbortError') return []
    return []
  }
}

// ─── V2 Details ───────────────────────────────────────────────────────────────
export async function getDetailsV2(
  provider: Provider,
  id: string,
  title?: string,
  year?: string,
  sources?: string,
  options?: { force?: boolean },
): Promise<V2Details | null> {
  try {
    const params: Record<string, string> = {}
    if (title) params.title = title
    if (year) params.year = year
    if (sources) params.sources = sources
    const data = await request<{ success: boolean; results: V2Details }>(
      `/api/v2/details/${provider}/${id}`,
      params,
      { ttlMs: DETAIL_TTL_MS, skipCache: options?.force },
    )
    return data?.results ?? null
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return null
  }
}

// ─── V2 Stream (explicit provider — for manual server switching) ───────────────
export async function getStreamV2(
  provider: Provider,
  id: string,
  sources?: { provider: string; id: string }[],
  dub?: string,
  season?: number,
  episode?: number,
  variant?: string,
): Promise<V2StreamResult> {
  try {
    const params: Record<string, string> = {}
    if (sources && sources.length > 0) {
      params.sources = sources.map((s) => `${s.provider}:${s.id}`).join(',')
    }
    if (dub) {
      params.dub = dub
      params.variant = dub
    }
    if (variant) {
      params.variant = variant
    }
    if (season !== undefined) params.season = String(season)
    if (episode !== undefined) params.episode = String(episode)

    const data = await request<V2StreamResult>(
      `/api/v2/stream/${provider}/${id}`,
      params,
      { ttlMs: STREAM_TTL_MS, skipCache: true, retries: 3 },
    )
    return data ?? { success: false, streams: [], subtitles: [] }
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return { success: false, streams: [], subtitles: [] }
  }
}

// ─── Backend-controlled pipeline stream (backend picks provider automatically) ──
/**
 * Calls the backend's deterministic sequential provider pipeline.
 * The backend — NOT the frontend — decides which provider to use.
 * Provider order: NetMirror (P1) → Peachify (P2) → future providers.
 *
 * Use this for ALL auto-play scenarios.
 * Use getStreamV2(provider, id) ONLY when the user explicitly selects a server.
 */
export async function resolveStream(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number,
  variant?: string,
): Promise<V2StreamResult> {
  try {
    const params: Record<string, string> = { type }
    if (season !== undefined) params.season = String(season)
    if (episode !== undefined) params.episode = String(episode)
    if (variant) params.variant = variant

    const data = await request<V2StreamResult>(
      `/api/v2/stream/tmdb/${tmdbId}`,
      params,
      { ttlMs: STREAM_TTL_MS, skipCache: true, retries: 0 },
    )
    return data ?? { success: false, available: false, streams: [], subtitles: [] }
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return { success: false, available: false, streams: [], subtitles: [] }
  }
}

// ─── Backend-controlled download pipeline (backend picks provider automatically) ─
/**
 * Calls the backend's deterministic sequential download pipeline.
 * The backend — NOT the frontend — decides which provider to use for downloads.
 * Provider order: NetMirror first (Peachify is embed-only and is automatically skipped).
 *
 * ARCHITECTURE RULE: Use this for ALL download scenarios.
 * NEVER call getStreamV2(provider, id) with a frontend-chosen provider for downloads.
 * The backend guarantees: NetMirror is always attempted first, and Peachify is
 * only used as a fallback if it ever gains download support.
 */
export async function resolveDownload(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number,
  variant?: string,
): Promise<V2StreamResult> {
  try {
    const params: Record<string, string> = { type }
    if (season !== undefined) params.season = String(season)
    if (episode !== undefined) params.episode = String(episode)
    if (variant) params.variant = variant

    const data = await request<V2StreamResult>(
      `/api/v2/download/tmdb/${tmdbId}`,
      params,
      { ttlMs: STREAM_TTL_MS, skipCache: true, retries: 1 },
    )
    return data ?? { success: false, available: false, streams: [], subtitles: [] }
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return { success: false, available: false, streams: [], subtitles: [] }
  }
}

// ─── V2 Download (explicit provider) ───────────────────────────────────────────
/**
 * Fetch direct, provider-specific download stream links (CDN-tokenized).
 */
export async function getDownloadV2(
  provider: string,
  id: string,
  season?: number,
  episode?: number,
  variant?: string,
): Promise<V2StreamResult> {
  try {
    const params: Record<string, string> = {}
    if (season !== undefined) params.season = String(season)
    if (episode !== undefined) params.episode = String(episode)
    if (variant) params.variant = variant

    const data = await request<V2StreamResult>(
      `/api/v2/download/${provider}/${id}`,
      params,
      { ttlMs: STREAM_TTL_MS, skipCache: true, retries: 1 },
    )
    return data ?? { success: false, streams: [], subtitles: [] }
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return { success: false, streams: [], subtitles: [] }
  }
}

// ─── TMDB List Proxies ────────────────────────────────────────────────────────
export async function getTmdbList(
  category: string, // trending, popular, top_rated, upcoming, popular_tv, discover
  params?: Record<string, string>,
): Promise<V2SearchResult[]> {
  try {
    const data = await request<{ success: boolean; results: V2SearchResult[] }>(
      `/api/v2/tmdb/${category}`,
      params,
      { ttlMs: DETAIL_TTL_MS } // Cache lists for 10 minutes
    )
    return data?.results ?? []
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return []
  }
}

// ─── Details By TMDB ID ────────────────────────────────────────────────────────
export async function getDetailsByTmdbId(
  tmdbId: string,
  type: string = 'movie',
  title?: string,
  year?: string,
): Promise<V2Details | null> {
  try {
    const params: Record<string, string> = { type }
    if (title) params.title = title
    if (year) params.year = year

    const data = await request<{ success: boolean; results: V2Details }>(
      `/api/v2/details/tmdb/${tmdbId}`,
      params,
      { ttlMs: DETAIL_TTL_MS }
    )
    return data?.results ?? null
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return null
  }
}

// ─── Season Episodes V2 ──────────────────────────────────────────────────────
export async function getSeasonEpisodesV2(
  tmdbId: string,
  seasonNumber: number,
  provider?: string,
  seriesId?: string,
  seasonId?: string
): Promise<any[]> {
  try {
    const params: Record<string, string> = {}
    if (provider) params.provider = provider
    if (seriesId) params.seriesId = seriesId
    if (seasonId) params.seasonId = seasonId

    const data = await request<{ success: boolean; results: any[] }>(
      `/api/v2/tmdb/season/${tmdbId}/${seasonNumber}`,
      params,
      { ttlMs: DETAIL_TTL_MS }
    )
    return data?.results ?? []
  } catch (err) {
    if (err instanceof ApiHttpError) throw err
    return []
  }
}




// ─── Health check ─────────────────────────────────────────────────────────────
export async function checkHealth(): Promise<boolean> {
  try {
    // Works in both modes: '/health' (Vite proxy) or 'https://host/health' (prod)
    const url = API_BASE_URL ? `${API_BASE_URL}/health` : '/health'
    const res = await fetch(url)
    return res.ok
  } catch {
    return false
  }
}

// ─── Synchronous Details Cache Retrievers ──────────────────────────────────────
export function getSyncCachedDetail(
  provider: Provider,
  id: string,
  title?: string,
  year?: string,
  sources?: string,
): V2Details | null {
  const params: Record<string, string> = {}
  if (title) params.title = title
  if (year) params.year = year
  if (sources) params.sources = sources
  const url = buildApiUrl(`/api/v2/details/${provider}/${id}`, params)
  const hit = getCached<{ results: V2Details }>(url)
  return hit?.results ?? null
}

export function getSyncCachedDetailsByTmdbId(
  tmdbId: string,
  type: string = 'movie',
  title?: string,
  year?: string,
): V2Details | null {
  const params: Record<string, string> = { type }
  if (title) params.title = title
  if (year) params.year = year
  const url = buildApiUrl(`/api/v2/details/tmdb/${tmdbId}`, params)
  const hit = getCached<{ results: V2Details }>(url)
  return hit?.results ?? null
}

// ─── Watch History API Requests ────────────────────────────────────────────────
export async function getHistoryV2(): Promise<any[] | null> {
  const url = buildApiUrl('/api/v2/history')
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' }
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.items || []
  } catch (err) {
    console.error('Failed to get watch history from backend:', err)
    return null
  }
}

export async function saveHistoryV2(item: any): Promise<boolean> {
  const url = buildApiUrl('/api/v2/history')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(item)
    })
    return res.ok
  } catch (err) {
    console.error('Failed to save watch history to backend:', err)
    return false
  }
}

export async function removeHistoryV2(id: string | number, type: string): Promise<boolean> {
  const url = buildApiUrl(`/api/v2/history/${type}/${id}`)
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    })
    return res.ok
  } catch (err) {
    console.error('Failed to delete watch history item from backend:', err)
    return false
  }
}

export async function clearHistoryV2(): Promise<boolean> {
  const url = buildApiUrl('/api/v2/history')
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { Accept: 'application/json' }
    })
    return res.ok
  } catch (err) {
    console.error('Failed to clear watch history from backend:', err)
    return false
  }
}
