/** Backend base URL — same contract as Flutter BackendService.
 *  Empty string in dev = Vite proxy forwards /api/* to localhost:6000 (no CORS).
 *  Set VITE_BACKEND_URL to the full origin in production builds.
 */
export const API_BASE_URL: string =
  import.meta.env.DEV ? '' : (import.meta.env.VITE_BACKEND_URL ?? '')

