import type { ReactNode } from 'react'

interface PageContainerProps {
  children: ReactNode
  className?: string
  wide?: boolean
}

export function PageContainer({
  children,
  className = '',
  wide = false,
}: PageContainerProps) {
  return (
    <div
      className={`mx-auto w-full px-5 sm:px-8 lg:px-10 ${
        wide ? 'max-w-[1720px]' : 'max-w-[1500px]'
      } ${className}`}
    >
      {children}
    </div>
  )
}
