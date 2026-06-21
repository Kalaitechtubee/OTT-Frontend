import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Movie } from '@/types/movie'
import { getHistoryV2, saveHistoryV2, removeHistoryV2, clearHistoryV2 } from '@/services/api'

export interface V2PlayContext {
  provider: string
  id: string
}

export interface WatchHistoryItem {
  movie: Movie
  progress: number
  duration: number
  updatedAt: number
  /** V2-specific: provider + provider-id for correct detail navigation */
  playContext?: V2PlayContext
}

const lastSyncMap = new Map<string, { timestamp: number; progress: number }>()

interface HistoryState {
  items: WatchHistoryItem[]
  addOrUpdate: (item: Omit<WatchHistoryItem, 'updatedAt'>, forceSync?: boolean) => void
  remove: (id: number, type: string) => void
  clearAll: () => void
  syncWithBackend: () => Promise<void>
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      addOrUpdate: (item, forceSync = false) => {
        const key = `${item.movie.type}-${item.movie.id}`
        const rest = get().items.filter(
          (i) => `${i.movie.type}-${i.movie.id}` !== key,
        )
        const updatedItem = { ...item, updatedAt: Date.now() }
        set({
          items: [
            updatedItem,
            ...rest,
          ].slice(0, 50),
        })

        // Sync with backend asynchronously, throttled to every 10s or 10s progress change
        const now = Date.now()
        const lastSync = lastSyncMap.get(key)

        if (
          forceSync ||
          !lastSync ||
          now - lastSync.timestamp > 10000 ||
          Math.abs(item.progress - lastSync.progress) > 10
        ) {
          lastSyncMap.set(key, { timestamp: now, progress: item.progress })
          void saveHistoryV2(updatedItem)
        }
      },
      remove: (id, type) => {
        const key = `${type}-${id}`
        lastSyncMap.delete(key)
        set({
          items: get().items.filter(
            (i) => !(i.movie.id === id && i.movie.type === type),
          ),
        })

        // Sync with backend
        void removeHistoryV2(id, type)
      },
      clearAll: () => {
        lastSyncMap.clear()
        set({ items: [] })

        // Sync with backend
        void clearHistoryV2()
      },
      syncWithBackend: async () => {
        try {
          const backendItems = await getHistoryV2()
          if (backendItems) {
            set({ items: backendItems.slice(0, 50) })
            console.log('[HistoryStore] Synchronized watch history with backend database.')
          }
        } catch (err) {
          console.warn('[HistoryStore] Failed to sync watch history with backend:', err)
        }
      }
    }),
    { name: 'moviezon-history' },
  ),
)
