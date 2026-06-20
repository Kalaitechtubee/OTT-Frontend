import React, { Suspense } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { MainLayout } from '@/layouts/MainLayout'
import { WatchLayout } from '@/layouts/WatchLayout'
import { ScrollRestoration } from '@/components/common/ScrollRestoration'
import { paths } from '@/routes/paths'
import { useAppStore } from '@/store/appStore'

const BootPage = React.lazy(() => import('@/pages/SplashPage').then((m) => ({ default: m.BootPage })))
const LanguagePage = React.lazy(() => import('@/pages/LanguagePage').then((m) => ({ default: m.LanguagePage })))
const LanguageHubPage = React.lazy(() => import('@/pages/LanguageHubPage').then((m) => ({ default: m.LanguageHubPage })))
const LanguageCategoryPage = React.lazy(() => import('@/pages/LanguageCategoryPage').then((m) => ({ default: m.LanguageCategoryPage })))
const HomePage = React.lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const MoviesPage = React.lazy(() => import('@/pages/MoviesPage').then((m) => ({ default: m.MoviesPage })))
const TvSeriesPage = React.lazy(() => import('@/pages/TvSeriesPage').then((m) => ({ default: m.TvSeriesPage })))
const SearchPage = React.lazy(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const LibraryPage = React.lazy(() => import('@/pages/LibraryPage').then((m) => ({ default: m.LibraryPage })))
const AccountPage = React.lazy(() => import('@/pages/AccountPage').then((m) => ({ default: m.AccountPage })))
const DetailPage = React.lazy(() => import('@/pages/DetailPage').then((m) => ({ default: m.DetailPage })))
const PlayerPage = React.lazy(() => import('@/pages/PlayerPage').then((m) => ({ default: m.PlayerPage })))

function BootGate({ children }: { children: ReactNode }) {
  const splashDone = useAppStore((s) => s.splashDone)
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  if (!splashDone && !preferredLanguage) {
    return <Navigate to={paths.boot} replace />
  }
  return children
}

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mz-background">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-mz-primary border-t-transparent" />
    </div>
  )
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ScrollRestoration />
      <Suspense fallback={<RouteLoader />}>
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
      </Suspense>
    </BrowserRouter>
  )
}
