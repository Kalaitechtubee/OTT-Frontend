import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  LANGUAGES,
  isSupportedLanguage,
  resolveLanguage,
  type LanguageName,
} from '@/core/constants/languages'

export { LANGUAGES, isSupportedLanguage, resolveLanguage, type LanguageName }

interface AppState {
  preferredLanguage: string
  setPreferredLanguage: (lang: string) => void
  splashDone: boolean
  setSplashDone: (v: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      preferredLanguage: '',
      setPreferredLanguage: (lang) => {
        set({ preferredLanguage: isSupportedLanguage(lang) ? resolveLanguage(lang) : '' })
      },
      splashDone: false,
      setSplashDone: (v) => set({ splashDone: v }),
    }),
    { name: 'moviezon-app' },
  ),
)
