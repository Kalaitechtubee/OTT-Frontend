import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
}

interface SelectFieldProps {
  label: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  icon?: ReactNode
  disabled?: boolean
  emptyLabel?: string
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  icon,
  disabled,
  emptyLabel = 'No options',
}: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find((opt) => opt.value === value) || options[0]

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = (val: string) => {
    if (disabled) return
    onChange(val)
    setIsOpen(false)
  }

  return (
    <div className="relative w-full max-w-md" ref={containerRef}>
      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-mz-secondary">
        {label}
      </label>
      
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex w-full items-center gap-2 rounded-lg border border-white/10 bg-mz-card px-3.5 py-3 text-left text-sm text-white outline-none transition duration-150 focus:border-mz-primary focus:ring-1 focus:ring-mz-primary disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? 'border-mz-primary ring-1 ring-mz-primary' : 'hover:border-white/20'
        }`}
      >
        {icon && <span className="shrink-0 text-mz-secondary">{icon}</span>}
        <span className="flex-1 truncate">
          {options.length === 0 ? emptyLabel : selectedOption?.label || ''}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-mz-secondary transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && options.length > 0 && (
        <ul className="absolute z-50 mt-1.5 max-h-60 w-full overflow-y-auto rounded-lg border border-white/10 bg-mz-card py-1.5 shadow-2xl backdrop-blur-md transition-all duration-200">
          {options.map((opt, index) => {
            const isSelected = opt.value === value
            return (
              <li key={`${index}-${opt.value || 'option'}`}>
                <button
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${
                    isSelected
                      ? 'text-mz-primary font-semibold'
                      : 'text-white/90 hover:text-white'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check className="h-4 w-4 text-mz-primary shrink-0 ml-2" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
