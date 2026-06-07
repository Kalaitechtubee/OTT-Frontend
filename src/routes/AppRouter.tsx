import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { WatchLayout } from '@/layouts/WatchLayout'
import { BootPage } from '@/pages/SplashPage'
import { LanguagePage } from '@/pages/LanguagePage'
import { LanguageHubPage } from '@/pages/LanguageHubPage'
import { LanguageCategoryPage } from '@/pages/LanguageCategoryPage'
import { HomePage } from '@/pages/HomePage'
import { MoviesPage } from '@/pages/MoviesPage'
import { TvSeriesPage } from '@/pages/TvSeriesPage'
import { SearchPage } from '@/pages/SearchPage'
import { LibraryPage } from '@/pages/LibraryPage'
import { AccountPage } from '@/pages/AccountPage'
import { DetailPage } from '@/pages/DetailPage'
import { PlayerPage } from '@/pages/PlayerPage'
import { paths } from '@/routes/paths'
import { useAppStore } from '@/store/appStore'

function BootGate({ children }: { children: ReactNode }) {
  const splashDone = useAppStore((s) => s.splashDone)
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  if (!splashDone && !preferredLanguage) {
    return <Navigate to={paths.boot} replace />
  }
  return children
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path={paths.boot} element={<BootPage />} />
        <Route path={paths.language} element={<LanguagePage />} />

        <Route
          element={
            <BootGate>
              <MainLayout />
            </BootGate>
          }
        >
          <Route path={paths.home} element={<HomePage />} />
          <Route path={paths.movies} element={<MoviesPage />} />
          <Route path={paths.tvSeries} element={<TvSeriesPage />} />
          <Route path={paths.search} element={<SearchPage />} />
          <Route path={paths.library} element={<LibraryPage />} />
          <Route path={paths.account} element={<AccountPage />} />
          <Route path="/language/:lang" element={<LanguageHubPage />} />
          <Route
            path="/language/:lang/:category"
            element={<LanguageCategoryPage />}
          />
        </Route>

        {/* V2: detail page — /title/:provider/:id or /title/tmdb/:tmdbId */}
        <Route path="/title/:provider/:id" element={<DetailPage />} />
        <Route path="/title/tmdb/:tmdbId" element={<DetailPage />} />

        {/* V2: watch page — /play/:provider/:id */}
        <Route element={<WatchLayout />}>
          <Route path="/play/:provider/:id" element={<PlayerPage />} />
        </Route>

        {/* Legacy redirects */}
        <Route path="/app" element={<Navigate to={paths.home} replace />} />
        <Route path="/app/search" element={<Navigate to={paths.search} replace />} />
        <Route path="/app/library" element={<Navigate to={paths.library} replace />} />
        <Route path="/app/profile" element={<Navigate to={paths.account} replace />} />

        <Route path="*" element={<Navigate to={paths.home} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
