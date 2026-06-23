import { create } from 'zustand'

interface ScrollState {
  pageScrolls: Record<string, number>
  carouselScrolls: Record<string, number>
  setPageScroll: (path: string, scrollY: number) => void
  setCarouselScroll: (key: string, scrollLeft: number) => void
  getPageScroll: (path: string) => number
  getCarouselScroll: (key: string) => number
  clearScrolls: () => void
}

export const useScrollStore = create<ScrollState>()((set, get) => ({
  pageScrolls: {},
  carouselScrolls: {},

  setPageScroll: (path, scrollY) => {
    set((state) => ({
      pageScrolls: { ...state.pageScrolls, [path]: scrollY },
    }))
  },

  setCarouselScroll: (key, scrollLeft) => {
    set((state) => ({
      carouselScrolls: { ...state.carouselScrolls, [key]: scrollLeft },
    }))
  },

  getPageScroll: (path) => {
    return get().pageScrolls[path] ?? 0
  },

  getCarouselScroll: (key) => {
    return get().carouselScrolls[key] ?? 0
  },

  clearScrolls: () => {
    set({ pageScrolls: {}, carouselScrolls: {} })
  },
}))
