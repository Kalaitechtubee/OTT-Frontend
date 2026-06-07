interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

const sizes = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-20 w-20 text-2xl',
}

export function AppLogo({ size = 'md', showText = false }: AppLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`${sizes[size]} bg-brand flex shrink-0 items-center justify-center rounded-xl font-bold text-white shadow-primary`}
      >
        MZ
      </div>
      {showText && (
        <span className="font-display text-xl font-black tracking-widest text-white">
          MOVIEZON
        </span>
      )}
    </div>
  )
}
