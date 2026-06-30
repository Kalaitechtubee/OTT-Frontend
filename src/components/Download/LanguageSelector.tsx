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
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
          Audio Language
        </span>
        <div className="flex-1 h-px bg-white/5" />
      </div>

      <div className="flex flex-wrap gap-2">
        {languages.map((lang) => {
          const isSelected = selectedLanguage === lang
          return (
            <button
              key={lang}
              type="button"
              onClick={() => onChange(lang)}
              aria-pressed={isSelected}
              className={`
                relative group flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold
                border transition-all duration-200 outline-none select-none cursor-pointer
                ${isSelected
                  ? 'bg-mz-primary border-mz-primary text-white shadow-[0_0_20px_rgba(229,9,20,0.25)]'
                  : 'bg-white/[0.03] border-white/8 text-white/60 hover:bg-white/[0.07] hover:border-white/15 hover:text-white'
                }
              `}
            >
              {/* Animated left indicator */}
              <span
                className={`
                  h-2 w-2 rounded-full flex-shrink-0 transition-all duration-200
                  ${isSelected ? 'bg-white scale-110' : 'bg-white/20 group-hover:bg-white/40'}
                `}
              />
              <span className="leading-none">{lang}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default LanguageSelector
