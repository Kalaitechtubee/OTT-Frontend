import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info, Play, Star } from 'lucide-react'
import { paths } from '@/routes/paths'
import { parseV2Rating } from '@/types/v2'
import type { V2SearchResult } from '@/types/v2'

const COLLAGE_POSTERS = [
  '/3bTC122o1lV1V5w6zs5pmZq5412.jpg', // American Psycho
  '/w8Ib836e1qCNr29T8n68zcgo42D.jpg', // Stranger Things
  '/czemb362HKwq8nWAx3U142646wa.jpg', // Dune: Part Two
  '/8Gxv2wSbsvJyLJZ8Xm4QOWBr242.jpg', // Oppenheimer
  '/qJ2tW6j374W7t23mU8z5t3mQ8z5.jpg', // The Dark Knight
  '/pB8BM7rnIpw2gTSR2mLHIf57v19.jpg', // Fight Club
  '/edv5CZv505E9yvfyv99mNuHzmJ0.jpg', // Inception
  '/f89U3wzqrjlg4z0fQ79679v5072.jpg', // The Matrix
  '/gEU2QvIPwc3Hzv1Y35jEs8qnJvG.jpg', // Interstellar
  '/d5i26jDw5RxD112UNcZExVIjP8w.jpg', // Pulp Fiction
  '/ggm5RQQGEFz9uI7u3fzh112vDnv.jpg', // Breaking Bad
  '/uKvH5jSS1y1RxnOTtB546bbHG1f.jpg', // The Last of Us
  '/8vt6IH4hk2ZFviF2445E1Wn2VnQ.jpg', // Spider-Man: Across the Spider-Verse
  '/wq4nIbvKydAN8OIfWjcaAo672rc.jpg', // Demon Slayer
  '/9pfq77jj0QxgY5R5ac457b01j5e.jpg', // Wednesday
  '/dDlE5y85ZIViCbqEQj092q7q0ZJ.jpg', // Squid Game
  '/r2J02Z2AIrj57n7j9MvYn6e2745.jpg', // Blade Runner 2049
  '/7WsyChwLEZgXekAB5VEt6go4nOI.jpg', // Chernobyl
  '/o7qi2v4uop1t3R85iIM0yx65CjT.jpg', // Succession
  '/A3ctkClIHJbRy7g5Wj6y1cZqQLY.jpg', // The Mandalorian
  '/1LRLL425JZ6eJ124r9JU5HQQ8Rk.jpg', // The Godfather
  '/5K7vWg4HJj76lh4FIgZSpz8t616.jpg', // Forrest Gump
  '/saF3501w4HgwG5211w7512dF0QJ.jpg', // The Shawshank Redemption
  '/pl9Q5w16gRi5V4994Y67t63mU8F.jpg', // Spirited Away
  '/v6x9Hn56Z2cGoGf74457v19dF0P.jpg', // Your Name
  '/A741w8Bf6ZgS8D3F976G51eF0QJ.jpg', // Attack on Titan
  '/7d87Vuk4qq5M552v4nKKiS84X4k.jpg', // Kill Bill
  '/6oom5RQQGEFz9uI7u3fzh112vDnv.jpg', // The Witcher
  '/h55211w7512dF0QJsaF3501w4Hgw.jpg', // Lord of the Rings
  '/rCeaUP1vY5W2c3t2B0M8z5t3mQ8z.jpg', // Gladiator II
  '/bSilf2445E1Wn2VnQ8vt6IH4hk2Z.jpg', // Severance
  '/x8y2s8c457b01j5f11285s4r114a.jpg', // Arcane
  '/q457b01j5f11285s4r114a8y2s8c.jpg', // The Crown
  '/nBNZadqL2QGctmaCT1TVL368AO2.jpg', // The Godfather Part II
  '/8tZYwwr2nhZg1BkVvGQ1J5tQ1mG.jpg', // Mad Max: Fury Road
  '/ty87Vuk4qq5M552v4nKKiS84X4k.jpg', // Gladiator
  '/11285s4r114a8y2s8c457b01j5f.jpg', // Jujutsu Kaisen
  '/49WJfeN0mfgR6ryh6VvNG7FFvGa.jpg', // Stranger Things 4
]


interface HeroBannerProps {
  items: V2SearchResult[]
  layout?: 'classic' | 'curved'
  allPosters?: string[]
}

export function HeroBanner({ items, layout = 'classic', allPosters }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    if (items.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % items.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [items.length])

  if (!items || items.length === 0) return null

  // Status mapper for active card vs adjacent cards (for curved layout)
  const getCardStatus = (index: number) => {
    const total = items.length
    if (index === activeIndex) return 'active'
    if (index === (activeIndex - 1 + total) % total) return 'left'
    if (index === (activeIndex + 1) % total) return 'right'
    return 'hidden'
  }

  const activeItem = items[activeIndex]
  const activeRating = parseV2Rating(activeItem.rating)

  if (layout === 'curved') {
    // 3D Curved Stack (Cover Flow layout) for Movies/TV Pages
    return (
      <section className="relative w-full overflow-hidden bg-mz-background pt-8 pb-12">
        {/* Ambient Dynamic Blur Background (Hidden on mobile to save GPU compositing/filter resources) */}
        <div className="absolute inset-0 z-0 h-[85%] overflow-hidden pointer-events-none hidden md:block">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-mz-background/80 to-mz-background z-10" />
          <div className="absolute inset-0 bg-mz-background/40 z-10" />
          {items.map((item, idx) => {
            const backdrop = item.backdrop || item.poster || ''
            const isActive = idx === activeIndex
            return (
              <img
                key={`bg-${idx}`}
                src={backdrop}
                alt=""
                className={`absolute inset-0 h-full w-full object-cover blur-3xl transition-opacity duration-1000 ease-in-out ${
                  isActive ? 'opacity-[0.25] scale-105' : 'opacity-0 scale-100'
                }`}
                decoding="async"
              />
            )
          })}
        </div>

        {/* 3D Stack */}
        <div className="relative z-10 mx-auto max-w-[1500px] px-4">
          <div className="relative flex h-[220px] sm:h-[310px] md:h-[380px] w-full items-center justify-center overflow-hidden perspective-container">
            {items.map((item, idx) => {
              const backdrop = item.backdrop || item.poster || ''
              const status = getCardStatus(idx)
              
              let statusClass = ''
              let shadowBorderClass = ''
              
              if (status === 'active') {
                statusClass = 'hero-card-active'
                shadowBorderClass = 'shadow-[0_20px_50px_rgba(225,29,72,0.35)] border-mz-primary/45'
              } else if (status === 'left') {
                statusClass = 'hero-card-left'
                shadowBorderClass = 'shadow-2xl border-white/5'
              } else if (status === 'right') {
                statusClass = 'hero-card-right'
                shadowBorderClass = 'shadow-2xl border-white/5'
              } else {
                statusClass = 'hero-card-hidden'
                shadowBorderClass = 'border-transparent'
              }

              return (
                <div
                  key={`card-${item.provider}-${item.id}-${idx}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`absolute w-[280px] sm:w-[460px] md:w-[580px] aspect-[16/9] rounded-2xl border overflow-hidden bg-mz-card transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) ${statusClass} ${shadowBorderClass}`}
                >
                  <img
                    src={backdrop}
                    alt={item.title}
                    className="h-full w-full object-cover"
                    decoding="async"
                  />
                  
                  {status !== 'active' && (
                    <div className="absolute inset-0 bg-black/45 transition-colors hover:bg-black/25 duration-300" />
                  )}

                  {status === 'active' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/15 opacity-0 hover:opacity-100 transition-opacity duration-300">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-mz-primary text-white shadow-lg shadow-mz-primary/30 transform scale-90 hover:scale-100 transition-transform cursor-pointer">
                        <Play className="h-6 w-6 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Active Item Metadata Info */}
          <div className="mt-8 text-center max-w-2xl mx-auto flex flex-col items-center animate-fadeScaleIn">
            {activeRating > 0 && (
              <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-full border border-mz-primary/25 bg-mz-primary/10 px-3 py-1 text-xs font-bold text-white shadow-sm shadow-mz-primary/10">
                <Star className="h-3.5 w-3.5 fill-mz-primary text-mz-primary" />
                TMDB {activeRating.toFixed(1)}
              </span>
            )}

            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-md tracking-tight">
              {activeItem.title}
            </h2>

            {activeItem.year && (
              <p className="mt-2 text-sm font-semibold text-mz-secondary">
                {activeItem.mediaType === 'tv' ? 'Series' : 'Movie'} · {activeItem.year}
              </p>
            )}

            {/* Action buttons */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() =>
                  navigate(paths.detail(activeItem.provider, activeItem.id, { title: activeItem.title, year: activeItem.year }))
                }
                className="btn-primary px-8 py-3 cursor-pointer shadow-primary hover:shadow-primary-lg"
              >
                <Play className="h-5 w-5 fill-white" />
                Watch now
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(paths.detail(activeItem.provider, activeItem.id, { title: activeItem.title, year: activeItem.year }))
                }
                className="btn-secondary px-6 py-3 cursor-pointer"
              >
                <Info className="h-5 w-5" />
                More info
              </button>
            </div>

            {/* Slide progress timers */}
            {items.length > 1 && (
              <div className="mt-8 flex gap-2 justify-center">
                {items.map((_, idx) => {
                  const isActive = idx === activeIndex
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveIndex(idx)}
                      className="relative h-1 w-8 sm:w-10 overflow-hidden rounded-full bg-white/20 hover:bg-white/45 transition-colors cursor-pointer"
                      aria-label={`Go to slide ${idx + 1}`}
                    >
                      <span
                        className="absolute left-0 top-0 bottom-0 bg-mz-primary rounded-full"
                        style={{
                          width: isActive ? '100%' : '0%',
                          transition: isActive ? 'width 5000ms linear' : 'none',
                        }}
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    )
  }

  // Classic Netflix-style diagonal floating poster grid hero section
  const dynamicPosters = items
    .map((item) => item.poster)
    .filter((url): url is string => Boolean(url))

  // Use dynamically loaded TMDB posters from the database, falling back to a static list if still loading.
  const allPostersPool = allPosters && allPosters.length > 5
    ? allPosters
    : [
        ...dynamicPosters,
        ...COLLAGE_POSTERS.map((path) => `https://image.tmdb.org/t/p/w342${path}`),
      ]

  // Column settings: [duration, scrollUp]
  const columnsConfig = [
    { duration: 75, up: true },
    { duration: 90, up: false },
    { duration: 65, up: true },
    { duration: 80, up: false },
    { duration: 70, up: true },
    { duration: 85, up: false },
    { duration: 60, up: true },
    { duration: 95, up: false },
    { duration: 72, up: true },
    { duration: 88, up: false },
    { duration: 68, up: true },
    { duration: 82, up: false },
  ]

  return (
    <section className="relative w-full h-screen min-h-[600px] overflow-hidden bg-black -mt-[84px] md:-mt-[64px] flex items-center justify-center">
      {/* 1. Straight Overlapping Floating Collage Grid */}
      <div className="absolute inset-0 w-full h-[105vh] -top-[2.5vh] flex gap-3 sm:gap-4.5 overflow-hidden pointer-events-none z-0 select-none opacity-65 sm:opacity-70 blur-none scale-[1.02]">
        {columnsConfig.map((col, colIdx) => {
          // Gather 12 items for this column
          const colItems = Array.from({ length: 12 }, (_, rowIdx) => {
            const poolIdx = (colIdx * 7 + rowIdx) % allPostersPool.length
            return allPostersPool[poolIdx]
          })

          // Double the items to allow continuous infinite marquee scrolling
          const scrollingItems = [...colItems, ...colItems]

          let visibilityClass = 'flex'
          if (colIdx >= 8) {
            visibilityClass = 'hidden xl:flex'
          } else if (colIdx >= 6) {
            visibilityClass = 'hidden lg:flex'
          } else if (colIdx >= 4) {
            visibilityClass = 'hidden md:flex'
          } else if (colIdx >= 3) {
            visibilityClass = 'hidden sm:flex'
          }

          return (
            <div
              key={`col-${colIdx}`}
              className={`collage-col flex-1 min-w-[60px] sm:min-w-[90px] md:min-w-[125px] ${visibilityClass} ${
                col.up ? 'animate-collage-up' : 'animate-collage-down'
              }`}
              style={{
                animationDuration: `${col.duration}s`,
                animationDelay: `${colIdx * -6}s`,
              }}
            >
              {scrollingItems.map((posterUrl, rowIdx) => {
                return (
                  <div
                    key={`poster-${colIdx}-${rowIdx}`}
                    className="relative w-full aspect-square shrink-0 rounded-[20px] overflow-hidden bg-mz-card border border-white/5 shadow-[0_15px_35px_rgba(0,0,0,0.85)] transition-transform duration-500 md:hover:scale-110 md:hover:shadow-[0_0_25px_rgba(229,9,20,0.45)] md:hover:border-mz-primary/45 md:hover:z-50 pointer-events-auto"
                  >
                    <img
                      src={posterUrl}
                      alt=""
                      className="h-full w-full object-cover brightness-90 contrast-105 saturate-110 select-none"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        // Suppress/fallback on loading error
                        ;(e.target as HTMLImageElement).src = 'https://image.tmdb.org/t/p/w342/qJ2tW6j374W7t23mU8z5t3mQ8z5.jpg'
                      }}
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 2. Premium Lightings & Overlays */}
      {/* Soft orange cinematic glow from top center */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[75vw] h-[45vh] rounded-full bg-gradient-to-b from-orange-500/18 to-transparent blur-[130px] pointer-events-none z-10" />
      
      {/* Stacked dark cinematic gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.75)_95%)] z-10 pointer-events-none" />
      <div className="absolute inset-0 bg-black/20 z-10 pointer-events-none" />
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-black/75 via-black/10 to-transparent z-10 pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-[30vh] bg-gradient-to-t from-black via-black/30 to-transparent z-10 pointer-events-none" />

      {/* 3. Center Content (Main Typography & CTAs) */}
      <div className="relative z-20 max-w-3xl px-6 text-center text-white flex flex-col items-center select-text">

        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.12] drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">
          Unlimited <span className="text-transparent bg-clip-text bg-gradient-to-r from-mz-primary to-orange-500">Movies</span>, <br className="hidden sm:inline" />
          TV Shows, & more.
        </h1>

        <p className="mt-5 text-sm sm:text-lg md:text-xl text-zinc-300 max-w-xl font-medium leading-relaxed drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          Stream anywhere. Cancel anytime. Start your cinematic journey today with our curated blockbusters.
        </p>

        {/* CTA Button Tray */}
        <div className="mt-8 flex flex-col sm:flex-row justify-center items-center gap-3.5 w-full sm:w-auto">
          <button
            onClick={() => {
              if (items && items.length > 0) {
                const first = items[0]
                navigate(paths.detail(first.provider, first.id, { title: first.title, year: first.year }))
              }
            }}
            className="group w-full sm:w-auto btn-primary px-7 py-3.5 text-sm font-bold rounded-full shadow-primary hover:shadow-primary-lg bg-mz-primary text-white transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <Play className="h-4 w-4 fill-white group-hover:scale-115 transition-transform" />
            Watch Now
          </button>
          
          <button
            onClick={() => {
              const firstGrid = document.querySelector('.relative.z-20.md\\:-mt-16')
              if (firstGrid) {
                firstGrid.scrollIntoView({ behavior: 'smooth', block: 'start' })
              } else {
                window.scrollTo({ top: window.innerHeight - 80, behavior: 'smooth' })
              }
            }}
            className="w-full sm:w-auto btn-secondary px-7 py-3.5 text-sm font-bold rounded-full border border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white text-white transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
          >
            <Info className="h-4 w-4" />
            Browse Content
          </button>
        </div>
      </div>
    </section>
  )
}

