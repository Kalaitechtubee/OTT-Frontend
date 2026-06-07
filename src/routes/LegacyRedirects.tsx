import { Navigate, useParams } from 'react-router-dom'
import { paths } from '@/routes/paths'

export function LegacyWatchRedirect() {
  const { type = 'movie', id = '0' } = useParams()
  return <Navigate to={paths.watch(type, id)} replace />
}
