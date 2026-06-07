import { getStreamV2, ApiHttpError } from '@/services/api'
import type { Provider } from '@/types/v2'
import type { StreamQualityItem } from '@/store/playerStore'

/**
 * Fetch V2 streams with retries.
 * Returns an array of StreamQualityItem ready for player use.
 */
export async function fetchV2Streams(
  provider: Provider,
  id: string,
  maxAttempts = 3,
): Promise<StreamQualityItem[]> {
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await getStreamV2(provider, id)

      if (!result || !result.streams || !result.streams.length) {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt === 1 ? 700 : 3500))
          continue
        }
        return []
      }

      return result.streams.map((s) => {
        const match = s.quality.match(/(\d+)/)
        const resolution = match ? parseInt(match[1], 10) : 0
        return { quality: s.quality, url: s.url, resolution }
      })
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const waitMs =
          err instanceof ApiHttpError && err.status === 502 ? 4000 : 1500 * attempt
        await new Promise((r) => setTimeout(r, waitMs))
      }
    }
  }

  if (lastError instanceof Error) throw lastError
  return []
}
