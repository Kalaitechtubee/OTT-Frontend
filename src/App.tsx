import { useEffect } from 'react'
import { AppRouter } from '@/routes/AppRouter'
import { useThemeStore } from '@/store/themeStore'
import { useHistoryStore } from '@/store/historyStore'

export default function App() {
  const initTheme = useThemeStore((s) => s.initTheme)
  const syncHistory = useHistoryStore((s) => s.syncWithBackend)

  useEffect(() => {
    initTheme()
    void syncHistory()
  }, [initTheme, syncHistory])

  return <AppRouter />
}
