import { Outlet } from 'react-router-dom'

/** Minimal chrome for fullscreen theater playback */
export function WatchLayout() {
  return (
    <div className="min-h-dvh bg-black text-white">
      <Outlet />
    </div>
  )
}
