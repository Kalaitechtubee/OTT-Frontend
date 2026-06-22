import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Globe, Search, User, Menu, X, Home, Film, Tv, Library } from 'lucide-react'
import { AppLogo } from '@/components/common/AppLogo'
import { appBrand } from '@/core/brand/appBrand'
import { useAppStore, isSupportedLanguage } from '@/store/appStore'
import { paths } from '@/routes/paths'

const navLinks = [
  { to: paths.home, label: 'Home', icon: Home },
  { to: paths.movies, label: 'Movies', icon: Film },
  { to: paths.tvSeries, label: 'TV Series', icon: Tv },
  { to: paths.search, label: 'Search', icon: Search },
  { to: paths.library, label: 'My List', icon: Library },
]

export function SiteHeader() {
  const navigate = useNavigate()
  const language = useAppStore((s) => s.preferredLanguage)
  const [query, setQuery] = useState('')
  const [isScrolled, setIsScrolled] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Lock scroll background when side drawer is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isDrawerOpen])

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    navigate(q ? `${paths.search}?q=${encodeURIComponent(q)}` : paths.search)
  }

  return (
    <header className={`sticky top-0 z-50 border-b transition-all duration-300 ${isScrolled
        ? 'border-white/8 bg-mz-background/95 max-md:bg-mz-background backdrop-blur-xl max-md:backdrop-blur-none shadow-lg shadow-black/40'
        : 'border-transparent bg-transparent'
      }`}>
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-4 px-5 py-3 sm:px-8 lg:px-10">
        {/* Mobile Hamburger Menu Trigger */}
        <button
          type="button"
          onClick={() => setIsDrawerOpen(true)}
          className="flex md:hidden items-center justify-center p-2 rounded-xl text-mz-secondary hover:text-white hover:bg-white/5 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <Link to={paths.home} className="flex shrink-0 items-center gap-2">
          <AppLogo size="sm" />
          <span className="hidden font-display text-sm font-black tracking-widest text-brand sm:inline">
            {appBrand.nameUpper}
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === paths.home}
              className={({ isActive }) =>
                `rounded-full border px-5 py-1.5 text-sm font-semibold transition-all duration-200 ${isActive
                  ? 'border-mz-primary text-white bg-mz-primary/10 shadow-primary'
                  : 'border-transparent text-mz-secondary hover:border-white/30 hover:text-white bg-transparent'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Search Bar Form */}
        <form onSubmit={onSearchSubmit} className="order-3 min-w-0 flex-1 md:order-none md:max-w-md md:ml-auto">
          <div className="input-field flex items-center gap-2.5 !py-0 !pl-3.5 !pr-4 focus-within:border-mz-primary focus-within:shadow-[0_0_0_1px_var(--mz-primary)]">
            <Search
              className="pointer-events-none h-4 w-4 shrink-0 text-mz-secondary"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies & TV shows..."
              className="min-w-0 flex-1 border-0 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-mz-secondary"
            />
          </div>
        </form>

        {/* Desktop User / Language settings */}
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {language && isSupportedLanguage(language) && (
            <Link
              to={paths.languageHub(language)}
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-mz-secondary transition hover:bg-white/5 hover:text-white lg:flex"
              title={`${language} Hub`}
            >
              {language} Hub
            </Link>
          )}
          <Link
            to={paths.language}
            className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-mz-secondary transition hover:bg-white/5 hover:text-white sm:flex"
            title="Content language"
          >
            <Globe className="h-4 w-4" />
            {language || 'Language'}
          </Link>
          <Link
            to={paths.account}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-mz-secondary transition hover:bg-white/5 hover:text-white"
          >
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">Account</span>
          </Link>
        </div>
      </div>

      {/* Mobile Glassmorphic Sliding Drawer Panel */}
      <div
        className={`fixed inset-0 z-50 flex md:hidden transition-opacity duration-300 ${isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
      >
        {/* Backdrop overlay */}
        <div
          className="absolute inset-0 bg-black/85"
          onClick={() => setIsDrawerOpen(false)}
        />

        {/* Drawer container content */}
        <div
          className={`relative flex w-72 max-w-[80vw] flex-col bg-mz-card/98 border-r border-white/5 shadow-2xl h-full transition-transform duration-300 ease-out z-10 ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
        >
          {/* Header section inside drawer */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <Link
              to={paths.home}
              onClick={() => setIsDrawerOpen(false)}
              className="flex items-center gap-2"
            >
              <AppLogo size="sm" />
              <span className="font-display text-sm font-black tracking-widest text-brand">
                {appBrand.nameUpper}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="rounded-xl p-2 text-mz-secondary hover:bg-white/5 hover:text-white cursor-pointer"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links inside drawer */}
          <nav className="flex-1 space-y-1.5 px-3 py-4 overflow-y-auto">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === paths.home}
                onClick={() => setIsDrawerOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-bold transition-all duration-200 ${isActive
                    ? 'bg-mz-primary/10 border border-mz-primary/20 text-mz-primary shadow-primary'
                    : 'border border-transparent text-mz-secondary hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="h-4.5 w-4.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Footer settings inside drawer */}
          <div className="border-t border-white/5 p-4 bg-black/20">
            <div className="space-y-1">
              <Link
                to={paths.language}
                onClick={() => setIsDrawerOpen(false)}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-xs font-bold text-mz-secondary hover:bg-white/5 hover:text-white transition"
              >
                <span className="flex items-center gap-2.5">
                  <Globe className="h-4 w-4" />
                  Language
                </span>
                <span className="text-white bg-white/10 px-2 py-0.5 rounded text-[10px] tracking-wider uppercase font-bold">
                  {language || 'Default'}
                </span>
              </Link>

              {language && isSupportedLanguage(language) && (
                <Link
                  to={paths.languageHub(language)}
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold text-mz-secondary hover:bg-white/5 hover:text-white transition"
                >
                  <Globe className="h-4 w-4 text-mz-primary" />
                  <span>{language} Hub</span>
                </Link>
              )}

              <Link
                to={paths.account}
                onClick={() => setIsDrawerOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold text-mz-secondary hover:bg-white/5 hover:text-white transition"
              >
                <User className="h-4 w-4" />
                <span>Account Profile</span>
              </Link>
            </div>
            <p className="mt-4 text-center text-[10px] font-bold text-mz-secondary/30 uppercase tracking-widest">
              MovieZon OTT v1.0
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
