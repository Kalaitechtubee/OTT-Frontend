/** Backend base URL — same contract as Flutter BackendService.
 *  Point directly to VITE_BACKEND_URL from .env (no Vite proxy).
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:8080'

