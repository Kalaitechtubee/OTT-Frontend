/** Shared brand tokens — keep in sync with flutter_app/lib/core/theme/app_colors.dart */
export const colors = {
  background: '#000000',
  surface: '#16161A',
  card: '#1E1E24',
  primary: '#E50914',
  accent: '#E50914',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  white: '#FFFFFF',
  textSecondary: '#A1A1AA',
  navBg: '#000000',
  homeBg: '#000000',
  searchBar: '#16161A',
  profileBar: '#16161A',
  logoSurface: '#16161A',
  splashCore: '#1E1E24',
} as const

export const fonts = {
  body: '"Inter", system-ui, sans-serif',
  display: '"Outfit", system-ui, sans-serif',
} as const

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
} as const

export const radius = {
  sm: '8px',
  md: '16px',
  lg: '24px',
  full: '9999px',
} as const

export type ThemeColors = typeof colors
