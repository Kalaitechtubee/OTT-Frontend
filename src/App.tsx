import { useEffect } from 'react'
import { AppRouter } from '@/routes/AppRouter'
import { useThemeStore } from '@/store/themeStore'

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme)

  useEffect(() => {
    initTheme()
  }, [initTheme])

  return <AppRouter />
}
