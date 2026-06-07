import { Link, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Clapperboard,
  Film,
  Flame,
  Sparkles,
  Tv,
  ArrowRight,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import {
  categoryTitle,
  HUB_CATEGORIES,
  resolveLanguage,
  LANGUAGES,
  type HubCategoryId,
} from '@/core/constants/languages'
import { paths } from '@/routes/paths'

const CATEGORY_ICONS: Record<HubCategoryId, typeof Flame> = {
  trending: Flame,
  movies: Film,
  series: Tv,
  dubbed: Clapperboard,
  new_releases: Sparkles,
}

const CATEGORY_DESCRIPTIONS: Record<HubCategoryId, string> = {
  trending: 'See what is hot and popular in the community right now.',
  movies: 'Browse full-length cinematic feature films across all genres.',
  series: 'Binge-watch top-rated television shows, seasons, and episodes.',
  dubbed: 'Enjoy international blockbusters with high-quality local dubs.',
  new_releases: 'Discover freshly added catalog entries and premiere titles.',
}

export function LanguageHubPage() {
  const { lang = 'Tamil' } = useParams<{ lang: string }>()
  const hubLanguage = resolveLanguage(lang)

  // Filter out the active language to show quick portal switcher links for the other hubs
  const otherLanguages = LANGUAGES.filter((l) => l.name !== hubLanguage)

  return (
    <PageContainer className="relative py-10 min-h-[70vh]">
      {/* Ambient Red Glow */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[300px] pointer-events-none z-0 opacity-40 md:opacity-60"
        style={{
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(229, 9, 20, 0.08) 0%, rgba(0, 0, 0, 0) 100%)'
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <Link
          to={paths.language}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-mz-secondary hover:text-white transition-colors duration-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Language settings
        </Link>

        <h1 className="font-display text-4xl font-black tracking-tight text-white mt-2">
          {hubLanguage} Hub
        </h1>
        <p className="mt-2 text-mz-secondary font-medium">
          Browse {hubLanguage} movies and series by category
        </p>

        {/* Categories Grid */}
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {HUB_CATEGORIES.map((category) => {
            const Icon = CATEGORY_ICONS[category.id]
            const title = categoryTitle(hubLanguage, category.id)
            const description = CATEGORY_DESCRIPTIONS[category.id]

            return (
              <li key={category.id} className="group">
                <Link
                  to={paths.languageCategory(hubLanguage, category.id)}
                  className="flex h-full min-h-[160px] flex-col justify-between rounded-2xl border border-white/8 bg-white/[0.02] p-6 backdrop-blur-md transition-all duration-300 hover:border-mz-primary/45 hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(229,9,20,0.12)] hover:-translate-y-1"
                >
                  <div>
                    {/* Glowing Icon container */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-mz-primary/10 border border-mz-primary/20 text-mz-primary transition duration-300 group-hover:scale-110 group-hover:bg-mz-primary/25 group-hover:shadow-[0_0_15px_rgba(229,9,20,0.3)]">
                      <Icon className="h-5.5 w-5.5" />
                    </div>

                    <p className="mt-4 font-bold text-lg text-white leading-tight transition duration-200 group-hover:text-mz-primary">
                      {title}
                    </p>
                    <p className="mt-1.5 text-xs text-mz-secondary/80 leading-relaxed font-medium">
                      {description}
                    </p>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    {/* Animated Chevron Indicator */}
                    <span className="flex items-center gap-1 text-xs font-semibold text-mz-secondary/50 transition-all duration-200 group-hover:text-mz-primary group-hover:translate-x-1">
                      Browse
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Regional Hub Selector Footer */}
        {otherLanguages.length > 0 && (
          <div className="mt-16 border-t border-white/5 pt-10">
            <h2 className="text-lg font-bold tracking-tight text-white mb-4">Switch Language Hub</h2>
            <div className="flex flex-wrap gap-3">
              {otherLanguages.map((lang) => (
                <Link
                  key={lang.name}
                  to={paths.languageHub(lang.name)}
                  className="rounded-xl border border-white/8 bg-white/[0.03] px-5 py-3.5 text-sm font-semibold text-mz-secondary transition duration-200 hover:border-mz-primary/30 hover:bg-mz-primary/5 hover:text-white hover:shadow-[0_0_15px_rgba(229,9,20,0.08)] active:scale-[0.98]"
                >
                  {lang.name} Hub ({lang.native})
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  )
}
