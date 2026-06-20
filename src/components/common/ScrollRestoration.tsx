import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const scrollPositions = new Map<string, number>()

export function ScrollRestoration() {
  const location = useLocation()

  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.set(location.pathname, window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [location.pathname])

  useEffect(() => {
    const saved = scrollPositions.get(location.pathname) ?? 0

    // Use a small timeout to let React layout/shimmer updates render and expand page height
    const timer = setTimeout(() => {
      window.scrollTo({
        top: saved,
        behavior: 'instant' as any // Use instant scrolling for seamless state updates
      })
    }, 60)

    return () => clearTimeout(timer)
  }, [location.pathname])

  return null
}
