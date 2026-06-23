import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useScrollStore } from '@/store/scrollStore'

export function ScrollRestoration() {
  const location = useLocation()
  const setPageScroll = useScrollStore((s) => s.setPageScroll)
  const getPageScroll = useScrollStore((s) => s.getPageScroll)

  useEffect(() => {
    const handleScroll = () => {
      // Save scroll position for the current pathname
      setPageScroll(location.pathname, window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [location.pathname, setPageScroll])

  useEffect(() => {
    const saved = getPageScroll(location.pathname)

    // Scroll immediately, but also trigger a minor deferred scroll to catch dynamic list heights.
    // Since we use a global catalog cache, content is rendered immediately,
    // making restoration highly reliable.
    window.scrollTo({
      top: saved,
      behavior: 'instant' as any
    })

    const timer = setTimeout(() => {
      window.scrollTo({
        top: saved,
        behavior: 'instant' as any
      })
    }, 60)

    return () => clearTimeout(timer)
  }, [location.pathname, getPageScroll])

  return null
}

