import { Link } from 'react-router-dom'
import {
  ChevronRight,
  HardDrive,
  Info,
  Smartphone,
  User,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import type { LucideIcon } from 'lucide-react'

interface SettingRow {
  icon: LucideIcon
  label: string
  description: string
  to?: string
  onClick?: () => void
}

export function AccountPage() {
  const clearCache = () => {
    try {
      const keys = Object.keys(localStorage).filter(
        (k) => k.startsWith('moviezon-') && k !== 'moviezon-app',
      )
      keys.forEach((k) => localStorage.removeItem(k))
      alert('Watch history cache cleared. Preferences kept.')
    } catch {
      alert('Could not clear cache.')
    }
  }

  const prefSettings: SettingRow[] = [
    {
      icon: HardDrive,
      label: 'Clear Watch History',
      description: 'Remove saved progress from this browser',
      onClick: clearCache,
    },
  ]

  const infoSettings: SettingRow[] = [
    {
      icon: Smartphone,
      label: 'Download Mobile App',
      description: 'Get offline downloads and device storage in the MovieZon app',
    },
    {
      icon: Info,
      label: 'Web Build Version',
      description: '1.0.0 (Stable release)',
    },
  ]

  return (
    <PageContainer className="py-12 max-w-3xl">
      {/* 1. Header Title */}
      <div className="flex flex-col select-text">
        <h1 className="font-display text-3xl font-black tracking-tight text-white lg:text-4xl">
          Account Settings
        </h1>
        <p className="mt-2 text-zinc-400 text-sm">
          Customize your web streaming experience and manage storage settings.
        </p>
      </div>

      {/* 2. Premium Profile Banner Card */}
      <div className="mt-10 relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-r from-zinc-900/95 via-zinc-900/60 to-transparent p-6 sm:p-8 backdrop-blur-md shadow-xl select-none">
        {/* Glow behind profile */}
        <div className="absolute -right-12 -top-12 h-36 w-36 rounded-full bg-mz-primary/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 relative z-10">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-mz-primary/30 bg-mz-primary/10 text-mz-primary shadow-lg shadow-mz-primary/10">
            <User className="h-10 w-10" />
          </div>
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <p className="text-xl font-bold text-white leading-none">Guest Streaming Profile</p>
              <span className="inline-flex items-center rounded-full bg-mz-primary/10 border border-mz-primary/30 px-2.5 py-0.5 text-3xs font-extrabold uppercase tracking-wider text-mz-primary">
                Web Viewer
              </span>
            </div>
            <p className="mt-2.5 text-sm text-zinc-400 max-w-md">
              Sign-in is not required. You have full access to stream all catalog titles directly in your browser.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Settings Sections */}
      <div className="mt-12 space-y-8 select-text">
        {/* Section A: Preferences */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500 mb-4.5">
            Streaming Preferences
          </h2>
          <div className="grid gap-3">
            {prefSettings.map((row) => {
              const ItemIcon = row.icon
              const isLink = !!row.to

              const itemContent = (
                <>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 border border-white/5 text-mz-primary shadow-sm">
                    <ItemIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm sm:text-base leading-snug">{row.label}</p>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-0.5 line-clamp-1">{row.description}</p>
                  </div>
                  {isLink && (
                    <ChevronRight className="h-5 w-5 text-zinc-500 transition-transform group-hover:translate-x-1" />
                  )}
                </>
              )

              if (row.to) {
                return (
                  <Link
                    key={row.label}
                    to={row.to}
                    className="group flex items-center gap-4.5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] p-4.5 transition-all duration-300 hover:border-mz-primary/20 hover:shadow-lg hover:shadow-black/20"
                  >
                    {itemContent}
                  </Link>
                )
              }

              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  disabled={!row.onClick}
                  className="group flex w-full items-center gap-4.5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-white/[0.04] p-4.5 text-left transition-all duration-300 hover:border-mz-primary/20 hover:shadow-lg hover:shadow-black/20 disabled:cursor-default cursor-pointer"
                >
                  {itemContent}
                </button>
              )
            })}
          </div>
        </div>

        {/* Section B: App Information */}
        <div>
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-zinc-500 mb-4.5">
            Device & Platform Information
          </h2>
          <div className="grid gap-3">
            {infoSettings.map((row) => {
              const ItemIcon = row.icon
              return (
                <div
                  key={row.label}
                  className="flex items-center gap-4.5 rounded-2xl border border-white/5 bg-white/[0.01] p-4.5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 border border-white/5 text-zinc-500">
                    <ItemIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-white text-sm sm:text-base leading-snug">{row.label}</p>
                    <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{row.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
