import React from 'react'

interface LanguageSelectorProps {
  languages: string[]
  selectedLanguage: string
  onChange: (lang: string) => void
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  languages,
  selectedLanguage,
  onChange,
}) => {
  if (languages.length === 0) return null

  return (
    <div className="space-y-3">
      <span className="block text-xs font-extrabold uppercase tracking-widest text-mz-secondary">
        Audio Language
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang
          return (
            <button
              key={lang}
              type="button"
              onClick={() => onChange(lang)}
              aria-checked={isSelected}
              role="radio"
              className={`
                flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold
                border transition-all duration-300 outline-none select-none cursor-pointer
                ${isSelected
                  ? 'bg-mz-primary/10 border-mz-primary text-mz-primary ring-1 ring-mz-primary/25'
                  : 'bg-mz-card border-white/5 text-mz-secondary hover:bg-white/[0.04] hover:text-white focus-visible:border-white/20'
                }
              `}
            >
              <span>{lang}</span>
              <div
                className={`
                  h-4 w-4 rounded-full border flex items-center justify-center transition-all duration-300
                  ${isSelected
                    ? 'border-mz-primary bg-mz-primary'
                    : 'border-white/20 bg-transparent'
                  }
                `}
              >
                {isSelected && (
                  <div className="h-1.5 w-1.5 rounded-full bg-white animate-scale-in" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LanguageSelector
