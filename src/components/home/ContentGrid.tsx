import { useEffect, useRef, useState, memo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PosterCard } from '@/components/common/PosterCard'
import { PageContainer } from '@/components/layout/PageContainer'
import { useScrollStore } from '@/store/scrollStore'
import type { V2SearchResult } from '@/types/v2'

interface ContentGridProps {
  title: string
  items: V2SearchResult[]
  showRank?: boolean
  variant?: 'grid' | 'rail' | 'trending' | 'large'
}

export const ContentGrid = memo(function ContentGrid({
  title,
  items,
  showRank,
  variant = 'rail',
}: ContentGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(true)
  const scrollTimeoutRef = useRef<number | null>(null)

  const setCarouselScroll = useScrollStore((s) => s.setCarouselScroll)
  const getCarouselScroll = useScrollStore((s) => s.getCarouselScroll)

  const checkScroll = () => {
    if (scrollTimeoutRef.current) {
      cancelAnimationFrame(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = requestAnimationFrame(() => {
      if (scrollRef.current) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
        setShowLeft(scrollLeft > 10)
        setShowRight(scrollLeft + clientWidth < scrollWidth - 15)
      }
    })
  }

  // Restore and listen to horizontal scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      // 1. Restore scroll position
      const savedScroll = getCarouselScroll(title)
      if (savedScroll > 0) {
        el.scrollLeft = savedScroll
      }

      // 2. Track scroll to save state
      const handleScrollSave = () => {
        setCarouselScroll(title, el.scrollLeft)
        checkScroll()
      }

      el.addEventListener('scroll', handleScrollSave, { passive: true })
      checkScroll()
      
      // Wait a bit for images/elements to render and measure again
      const timer = setTimeout(checkScroll, 200)
      window.addEventListener('resize', checkScroll, { passive: true })

      return () => {
        el.removeEventListener('scroll', handleScrollSave)
        clearTimeout(timer)
        window.removeEventListener('resize', checkScroll)
        if (scrollTimeoutRef.current) {
          cancelAnimationFrame(scrollTimeoutRef.current)
        }
      }
    }
  }, [items, title, getCarouselScroll, setCarouselScroll])

  if (!items.length) return null

  const handleScroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current
      const scrollAmount = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  return (
    <section className="relative py-6 overflow-hidden">
      {/* Subtle radial gradient background */}
      <div className="absolute left-[-100px] top-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-mz-primary/4 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute right-[-100px] top-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-mz-primary/3 rounded-full blur-3xl pointer-events-none" />

      <PageContainer>
        <div className="mb-4 flex items-center gap-3">
          <span className="h-6 w-1 rounded-full bg-mz-primary shadow-primary" />
          <h2 className="font-display text-2xl font-black tracking-tight lg:text-3xl">{title}</h2>
        </div>
      </PageContainer>

      <div className="group/rail relative px-1">
        {/* Safe side overlays replacing mask-gradient-x on mobile/desktop without compositing issues */}
        <div 
          className="pointer-events-none absolute left-0 top-0 bottom-6 w-10 sm:w-16 bg-gradient-to-r from-mz-background to-transparent z-25 transition-opacity duration-300" 
          style={{ opacity: showLeft ? 1 : 0 }}
        />
        <div 
          className="pointer-events-none absolute right-0 top-0 bottom-6 w-10 sm:w-16 bg-gradient-to-l from-mz-background to-transparent z-25 transition-opacity duration-300"
          style={{ opacity: showRight ? 1 : 0 }}
        />

        {/* Left Arrow Button */}
        <button
          onClick={() => handleScroll('left')}
          className={`absolute left-4 top-[40%] -translate-y-1/2 z-30 hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur-md transition-all duration-300 shadow-lg cursor-pointer ${showLeft
              ? 'opacity-0 md:group-hover/rail:opacity-100 md:hover:scale-110 md:hover:bg-black/90 md:hover:border-mz-primary/50'
              : 'opacity-0 pointer-events-none'
            }`}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        {/* Right Arrow Button */}
        <button
          onClick={() => handleScroll('right')}
          className={`absolute right-4 top-[40%] -translate-y-1/2 z-30 hidden md:flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/70 text-white backdrop-blur-md transition-all duration-300 shadow-lg cursor-pointer ${showRight
              ? 'opacity-0 md:group-hover/rail:opacity-100 md:hover:scale-110 md:hover:bg-black/90 md:hover:border-mz-primary/50'
              : 'opacity-0 pointer-events-none'
            }`}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div
          ref={scrollRef}
          className="no-scrollbar scroll-rail-bleed flex gap-4 overflow-x-auto pb-6 pt-4 scroll-smooth"
        >
          {items.map((item, i) => (
            <PosterCard
              key={`${item.provider}-${item.id}-${i}`}
              result={item}
              rank={showRank ? i + 1 : undefined}
              variant={variant}
            />
          ))}
        </div>
      </div>
    </section>
  )
})


