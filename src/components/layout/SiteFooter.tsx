import { Link } from 'react-router-dom'
import { appBrand } from '@/core/brand/appBrand'
import { paths } from '@/routes/paths'

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-white/8 bg-mz-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div>
          <p className="font-display text-lg font-bold text-brand">
            {appBrand.name}
          </p>
          <p className="mt-1 text-sm text-mz-secondary">{appBrand.tagline}</p>
        </div>
        <div className="flex flex-wrap gap-6 text-sm text-mz-secondary">
          <Link to={paths.home} className="transition hover:text-white">
            Home
          </Link>
          <Link to={paths.search} className="transition hover:text-white">
            Search
          </Link>
          <Link to={paths.library} className="transition hover:text-white">
            My List
          </Link>
          <Link to={paths.account} className="transition hover:text-white">
            Account
          </Link>
        </div>
        <p className="text-xs text-mz-secondary">
          © {new Date().getFullYear()} {appBrand.name}. Watch on web.
        </p>
      </div>
    </footer>
  )
}
