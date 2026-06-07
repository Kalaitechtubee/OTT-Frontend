import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Movie } from '@/types/movie'

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

interface HistoryState {
  items: WatchHistoryItem[]
  addOrUpdate: (item: Omit<WatchHistoryItem, 'updatedAt'>) => void
  remove: (id: number, type: string) => void
  clearAll: () => void
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      addOrUpdate: (item) => {
        const key = `${item.movie.type}-${item.movie.id}`
        const rest = get().items.filter(
          (i) => `${i.movie.type}-${i.movie.id}` !== key,
        )
        set({
          items: [
            { ...item, updatedAt: Date.now() },
            ...rest,
          ].slice(0, 50),
        })
      },
      remove: (id, type) =>
        set({
          items: get().items.filter(
            (i) => !(i.movie.id === id && i.movie.type === type),
          ),
        }),
      clearAll: () => set({ items: [] }),
    }),
    { name: 'moviezon-history' },
  ),
)
