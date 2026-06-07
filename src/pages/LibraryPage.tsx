import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Play, Trash2, History, Download } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { paths } from '@/routes/paths'
import { useHistoryStore } from '@/store/historyStore'
import { useDownloadStore } from '@/store/downloadStore'
import { usePlayerStore } from '@/store/playerStore'
import { getOfflineVideo } from '@/utils/offlineStorage'
import { posterUrl, cleanLanguageName } from '@/types/movie'

type LibraryTab = 'watchlist' | 'downloads'

export function LibraryPage() {
  const [tab, setTab] = useState<LibraryTab>('watchlist')
  const navigate = useNavigate()
  const play = usePlayerStore((s) => s.play)

  const items = useHistoryStore((s) => s.items)
  const clearAll = useHistoryStore((s) => s.clearAll)
  const remove = useHistoryStore((s) => s.remove)

  const downloads = useDownloadStore((s) => s.items)
  const cancelDownload = useDownloadStore((s) => s.cancelDownload)
  const deleteDownload = useDownloadStore((s) => s.deleteDownload)



  const playOffline = async (item: (typeof downloads)[number]) => {
    const blob = await getOfflineVideo(item.downloadId)
    if (!blob) return

    const parts = item.downloadId.split('-')
    const provider = parts[0] || 'net11'
    const id = parts[1] || String(item.tmdbId)

    play(
      item.title,
      item.posterPath ?? null,
      { provider, id },
      URL.createObjectURL(blob),
      [{ quality: `${item.resolution}p`, url: '' }],
      `${item.resolution}p`,
    )
    navigate(paths.watch(provider, id))
  }

  return (
    <PageContainer className="relative py-10 min-h-[70vh]">
      {/* Ambient Red Glow in Background */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1200px] h-[300px] pointer-events-none z-0 opacity-40 md:opacity-60"
        style={{
          background: 'radial-gradient(50% 50% at 50% 50%, rgba(229, 9, 20, 0.08) 0%, rgba(0, 0, 0, 0) 100%)'
        }}
      />

      <div className="relative z-10 max-w-[1200px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-black tracking-tight text-white">My List</h1>
            <p className="mt-2 text-mz-secondary font-medium">
              Continue watching and manage downloaded offline media
            </p>
          </div>
          {tab === 'watchlist' && items.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-xl border border-mz-error/30 px-4 py-2.5 text-sm font-semibold text-mz-error hover:bg-mz-error/10 transition duration-200 cursor-pointer"
            >
              <Trash2 className="h-4 w-4" />
              Clear Watch History
            </button>
          )}
        </div>

        {/* Premium Glassmorphic Pill Tab Switcher */}
        <div className="mt-8 flex gap-2.5 bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 w-fit backdrop-blur-md">
          <button
            type="button"
            onClick={() => setTab('watchlist')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
              tab === 'watchlist'
                ? 'bg-mz-primary text-white shadow-primary shadow-lg'
                : 'text-mz-secondary hover:text-white'
            }`}
          >
            Continue Watching
          </button>
          <button
            type="button"
            onClick={() => setTab('downloads')}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 cursor-pointer ${
              tab === 'downloads'
                ? 'bg-mz-primary text-white shadow-primary shadow-lg'
                : 'text-mz-secondary hover:text-white'
            }`}
          >
            Downloads
          </button>
        </div>

        {tab === 'watchlist' ? (
          items.length === 0 ? (
            /* Custom Redesigned Watchlist Empty State */
            <div className="mt-16 flex flex-col items-center justify-center text-center p-12 rounded-3xl bg-white/[0.02] border border-white/5 max-w-md mx-auto backdrop-blur-md">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-mz-secondary/40 mb-4">
                <History className="h-8 w-8" />
              </div>
              <p className="font-bold text-white text-lg">Watchlist is Empty</p>
              <p className="mt-2 text-sm text-mz-secondary leading-relaxed">
                You haven't started watching any movies or shows yet. Start browsing the catalog!
              </p>
              <Link
                to={paths.home}
                className="btn-primary mt-6"
              >
                Browse Recommendations
              </Link>
            </div>
          ) : (
            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(({ movie, progress, duration, playContext: ctx }) => {
                const pct = duration > 0 ? (progress / duration) * 100 : 0
                const detailPath = ctx
                  ? paths.detail(ctx.provider, ctx.id, { title: movie.title })
                  : paths.detail(movie.type, movie.overview || String(movie.id))
                return (
                  <li
                    key={`${movie.type}-${movie.id}`}
                    className="group relative flex items-start gap-4 rounded-2xl border border-white/8 bg-white/[0.02] p-4.5 backdrop-blur-md transition-all duration-300 hover:border-mz-primary/45 hover:bg-white/[0.06] hover:shadow-[0_0_20px_rgba(229,9,20,0.12)] hover:-translate-y-1"
                  >
                    <Link
                      to={detailPath}
                      className="flex min-w-0 flex-1 flex-col min-[420px]:flex-row gap-4.5"
                    >
                      {/* Premium Cover with Hover Play Icon and progress bar */}
                      <div className="relative aspect-video w-full min-[420px]:h-24 min-[420px]:w-40 shrink-0 overflow-hidden rounded-xl bg-mz-surface border border-white/5 shadow-md">
                        {movie.posterPath && (
                          <img
                            src={posterUrl(movie.posterPath, 'w342')}
                            alt=""
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        )}
                        {/* Centered Hover Play Button Overlay */}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                          <div className="rounded-full bg-mz-primary p-2 text-white shadow-lg shadow-mz-primary/30">
                            <Play className="h-4 w-4 fill-white" />
                          </div>
                        </div>
                        {/* Progress bar with red glow */}
                        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/20">
                          <div
                            className="h-full bg-mz-primary shadow-[0_0_8px_var(--mz-primary)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="min-w-0 flex-1 py-1">
                        <p className="font-bold text-white group-hover:text-mz-primary transition-colors duration-200 line-clamp-2 leading-tight">
                          {movie.title}
                        </p>
                        <p className="mt-2 text-xs font-semibold capitalize text-mz-secondary/80 flex items-center gap-1.5">
                          <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-[10px] tracking-wider uppercase font-bold text-white">
                            {movie.type}
                          </span>
                          {ctx && (
                            <span className="text-mz-secondary/60">
                              via {ctx.provider}
                            </span>
                          )}
                        </p>
                        <p className="mt-2 text-[10px] font-bold text-mz-secondary/60 uppercase tracking-wider">
                          {Math.round(pct)}% Completed
                        </p>
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(movie.id, movie.type)}
                      className="self-start rounded-xl p-2 text-mz-secondary/70 hover:bg-mz-error/10 hover:text-mz-error transition-all duration-200 cursor-pointer"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )
        ) : (
          <div className="mt-10">
            <DownloadSection
              title="Downloads"
              description="Manage and play back your downloaded movies and series."
              items={downloads}
              onPlay={playOffline}
              onCancel={cancelDownload}
              onDelete={deleteDownload}
            />
          </div>
        )}
      </div>
    </PageContainer>
  )
}

function DownloadSection({
  title,
  description,
  items,
  onPlay,
  onCancel,
  onDelete,
}: {
  title: string
  description: string
  items: ReturnType<typeof useDownloadStore.getState>['items']
  onPlay?: (item: (typeof items)[number]) => void
  onCancel: (id: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <section className="border-t border-white/5 pt-8 first:border-0 first:pt-0">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-mz-primary shadow-[0_0_6px_var(--mz-primary)]" />
        <h2 className="font-display text-xl font-black text-white">{title}</h2>
      </div>
      <p className="mt-1.5 text-sm font-medium text-mz-secondary/80">{description}</p>

      {items.length === 0 ? (
        /* Re-designed Download Section Empty State */
        <div className="mt-6 flex flex-col items-center justify-center text-center p-10 rounded-2xl bg-white/[0.01] border border-dashed border-white/10">
          <Download className="h-6 w-6 text-mz-secondary/30 mb-2" />
          <p className="text-sm font-semibold text-mz-secondary/60">No downloads saved in this section.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-4">
          {items.map((item) => (
            <li
              key={item.downloadId}
              className="group flex flex-col min-[420px]:flex-row items-start min-[420px]:items-center gap-4.5 rounded-2xl border border-white/8 bg-white/[0.02] p-4.5 backdrop-blur-md transition-all duration-300 hover:border-white/15 hover:bg-white/[0.04] w-full"
            >
              {/* Media Thumbnail with hover play overlay if completed */}
              <div className="relative aspect-video w-full min-[420px]:h-20 min-[420px]:w-32 shrink-0 overflow-hidden rounded-xl bg-mz-surface border border-white/5 shadow-md">
                {item.posterPath && (
                  <img
                    src={posterUrl(item.posterPath, 'w185')}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
                {onPlay && item.status === 'completed' && item.isOffline && (
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <div className="rounded-full bg-mz-primary p-1.5 text-white shadow-lg">
                      <Play className="h-3.5 w-3.5 fill-white" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Metadata Details */}
              <div className="min-w-0 flex-1 py-0.5 w-full">
                <p className="font-bold text-white group-hover:text-mz-primary transition-colors duration-200 line-clamp-2 leading-tight text-base">
                  {item.type === 'tv' && item.season != null && item.episode != null
                    ? `${item.title} (S${item.season} E${item.episode})`
                    : item.title}
                </p>
                <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-mz-secondary/80">
                  <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded-md text-[10px] tracking-wider uppercase font-bold text-white">
                    {item.resolution}p
                  </span>
                  <span>·</span>
                  <span>{cleanLanguageName(item.language)}</span>
                  <span>·</span>
                  <span className={`capitalize ${item.status === 'completed' ? 'text-mz-success' : 'text-mz-primary animate-pulse'}`}>
                    {item.status}
                  </span>
                </div>

                {/* Progress bar for downloading downloads */}
                {item.status === 'downloading' && (
                  <div className="mt-3.5 max-w-xs">
                    <div className="flex items-center justify-between text-[10px] font-bold text-mz-secondary/70 mb-1">
                      <span>Downloading files...</span>
                      <span>{Math.round(item.progress)}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-mz-primary shadow-[0_0_8px_var(--mz-primary)] transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons list */}
              <div className="flex flex-wrap items-center gap-3 mt-3.5 min-[420px]:mt-0 w-full min-[420px]:w-auto justify-end sm:justify-start">
                {onPlay && item.status === 'completed' && item.isOffline && (
                  <button
                    type="button"
                    onClick={() => onPlay(item)}
                    className="btn-primary flex items-center gap-1.5 py-2 px-4 text-xs"
                  >
                    <Play className="h-3.5 w-3.5 fill-white" />
                    Play Offline
                  </button>
                )}
                {item.status === 'downloading' && (
                  <button
                    type="button"
                    onClick={() => onCancel(item.downloadId)}
                    className="btn-secondary py-2 px-4 text-xs"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onDelete(item.downloadId)}
                  className="rounded-xl p-2.5 text-mz-secondary/70 hover:bg-mz-error/10 hover:text-mz-error transition-all duration-200 cursor-pointer"
                  aria-label="Delete download"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
