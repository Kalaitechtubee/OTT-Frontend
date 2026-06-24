import { resolveDownload } from '@/services/api'
import type { V2StreamResult } from '@/types/v2'

/**
 * Calls the backend resolved details endpoint to retrieve download stream links.
 */
export async function fetchDownloadDetails(
  tmdbId: string,
  type: 'movie' | 'tv' = 'movie',
  season?: number,
  episode?: number,
  variant?: string
): Promise<V2StreamResult> {
  return await resolveDownload(tmdbId, type, season, episode, variant)
}
