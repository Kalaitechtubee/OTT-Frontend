import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { appBrand } from '@/core/brand/appBrand'
import { AppLogo } from '@/components/common/AppLogo'
import { checkHealth } from '@/services/api'
import { useAppStore } from '@/store/appStore'
import { paths } from '@/routes/paths'

export function BootPage() {
  const navigate = useNavigate()
  const preferredLanguage = useAppStore((s) => s.preferredLanguage)
  const setSplashDone = useAppStore((s) => s.setSplashDone)

  useEffect(() => {
    const boot = async () => {
      await checkHealth()
      await new Promise((r) => setTimeout(r, 1200))
      setSplashDone(true)
      navigate(
        preferredLanguage ? paths.home : paths.language,
        { replace: true },
      )
    }
    boot()
  }, [navigate, preferredLanguage, setSplashDone])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-mz-background px-6">
      <AppLogo size="lg" showText />
      <p className="mt-4 text-sm text-mz-secondary">{appBrand.splashTagline}</p>
      <div className="mt-10 h-1 w-48 overflow-hidden rounded-full bg-mz-card">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-brand" />
      </div>
      <p className="mt-4 text-xs text-mz-secondary">Loading catalog…</p>
    </div>
  )
}
