import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { appBrand } from '@/core/brand/appBrand'
import { resolveLanguage } from '@/core/constants/languages'
import { LANGUAGES, useAppStore } from '@/store/appStore'
import { paths } from '@/routes/paths'

export function LanguagePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isSettings = params.get('from') === 'account'
  const saved = useAppStore((s) => s.preferredLanguage)
  const setPreferredLanguage = useAppStore((s) => s.setPreferredLanguage)
  const [selected, setSelected] = useState(resolveLanguage(saved || 'Tamil'))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await new Promise((r) => setTimeout(r, 300))
    setPreferredLanguage(selected)
    setSaving(false)
    navigate(isSettings ? paths.account : paths.home, { replace: !isSettings })
  }

  return (
    <PageContainer className="py-10">
      {isSettings && (
        <button
          type="button"
          onClick={() => navigate(paths.account)}
          className="mb-6 flex items-center gap-1 text-sm text-mz-secondary hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to account
        </button>
      )}

      <div className="mx-auto max-w-lg">
        <h1 className="font-display text-3xl font-bold">Content language</h1>
        <p className="mt-2 text-mz-secondary">
          {appBrand.tagline} — South Indian catalog: Tamil, Telugu, Malayalam, Kannada
        </p>

        <ul className="mt-8 space-y-2">
          {LANGUAGES.map((lang) => {
            const active = selected === lang.name
            return (
              <li key={lang.name}>
                <button
                  type="button"
                  onClick={() => setSelected(lang.name)}
                  className={`flex w-full items-center justify-between rounded-xl border px-5 py-4 text-left transition ${
                    active
                      ? 'border-mz-primary bg-mz-card ring-1 ring-mz-primary'
                      : 'border-white/10 bg-mz-surface hover:border-white/40'
                  }`}
                >
                  <div>
                    <p className="font-semibold">{lang.name}</p>
                    <p className="text-sm text-mz-secondary">{lang.native}</p>
                  </div>
                  {active && <Check className="h-5 w-5 text-mz-primary" />}
                </button>
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="btn-primary mt-8 w-full py-3.5"
        >
          {saving ? 'Saving…' : 'Save preference'}
        </button>

        <Link
          to={paths.languageHub(selected)}
          className="btn-secondary mt-4 w-full py-3.5"
        >
          Browse {selected} Hub
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </PageContainer>
  )
}
