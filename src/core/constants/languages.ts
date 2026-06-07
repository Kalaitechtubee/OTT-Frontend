/** South Indian catalog languages — matches backend languageMatchers.js */
export const LANGUAGES = [
  { name: 'Tamil', native: 'தமிழ்' },
  { name: 'Telugu', native: 'తెలుగు' },
  { name: 'Malayalam', native: 'മലയാളം' },
  { name: 'Kannada', native: 'ಕನ್ನಡ' },
] as const

export type LanguageName = (typeof LANGUAGES)[number]['name']

export const HUB_CATEGORIES = [
  { id: 'trending', titleSuffix: 'Trending', railKey: 'trending' },
  { id: 'movies', titleSuffix: 'Movies', railKey: 'native_movies_lang' },
  { id: 'series', titleSuffix: 'Series', railKey: 'tv_shows_lang' },
  { id: 'dubbed', titleSuffix: 'Dubbed Movies', railKey: 'dubbed_movies_lang' },
  { id: 'new_releases', titleSuffix: 'New Releases', railKey: 'new_releases' },
] as const

export type HubCategoryId = (typeof HUB_CATEGORIES)[number]['id']

export function isSupportedLanguage(language: string): boolean {
  const lower = language.toLowerCase().trim()
  return LANGUAGES.some((l) => l.name.toLowerCase() === lower)
}

export function resolveLanguage(language: string | undefined): LanguageName {
  if (language && isSupportedLanguage(language)) {
    return LANGUAGES.find((l) => l.name.toLowerCase() === language.toLowerCase())!
      .name as LanguageName
  }
  return 'Tamil'
}

export function categoryTitle(language: string, categoryId: HubCategoryId): string {
  const lang = resolveLanguage(language)
  if (categoryId === 'trending') return `Trending ${lang}`
  if (categoryId === 'new_releases') return `New ${lang} Releases`
  const cat = HUB_CATEGORIES.find((c) => c.id === categoryId)
  if (!cat) return lang
  if (categoryId === 'dubbed') return `${lang} Dubbed Movies`
  return `${lang} ${cat.titleSuffix}`
}
