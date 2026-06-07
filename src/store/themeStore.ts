import { create } from 'zustand'
import { colors, fonts, radius, spacing, type ThemeColors } from '@/core/theme/tokens'

const CSS_MAP: Record<keyof ThemeColors, string> = {
  background: '--mz-background',
  surface: '--mz-surface',
  card: '--mz-card',
  primary: '--mz-primary',
  accent: '--mz-accent',
  success: '--mz-success',
  error: '--mz-error',
  warning: '--mz-warning',
  white: '--mz-white',
  textSecondary: '--mz-text-secondary',
  navBg: '--mz-nav-bg',
  homeBg: '--mz-home-bg',
  searchBar: '--mz-search-bar',
  profileBar: '--mz-profile-bar',
  logoSurface: '--mz-logo-surface',
  splashCore: '--mz-splash-core',
}

function applyThemeToDocument(themeColors: ThemeColors) {
  const root = document.documentElement
  for (const [key, cssVar] of Object.entries(CSS_MAP)) {
    root.style.setProperty(cssVar, themeColors[key as keyof ThemeColors])
  }
  root.style.setProperty('--mz-font-body', fonts.body)
  root.style.setProperty('--mz-font-display', fonts.display)
  root.style.setProperty('--mz-radius-sm', radius.sm)
  root.style.setProperty('--mz-radius-md', radius.md)
  root.style.setProperty('--mz-radius-lg', radius.lg)
  root.style.setProperty('--mz-spacing-md', spacing.md)
}

interface ThemeState {
  colors: ThemeColors
  initTheme: () => void
  /** Override brand colors at runtime (e.g. A/B or white-label) */
  setColors: (partial: Partial<ThemeColors>) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  colors: { ...colors },
  initTheme: () => applyThemeToDocument(get().colors),
  setColors: (partial) => {
    const next = { ...get().colors, ...partial }
    set({ colors: next })
    applyThemeToDocument(next)
  },
}))
