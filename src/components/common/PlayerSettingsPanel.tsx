import { useState, useRef, useEffect, useCallback } from 'react'
import { Settings, Volume2, Subtitles, MonitorPlay, Check, X, ChevronRight } from 'lucide-react'

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface AudioTrackInfo {
  id: number
  language: string
  label: string
}

export interface SubtitleTrackInfo {
  id: number
  language: string
  label: string
}

export interface QualityOption {
  value: string
  label: string
}

interface PlayerSettingsPanelProps {
  /* Audio */
  audioTracks: AudioTrackInfo[]
  selectedAudioTrackId: number
  onAudioTrackChange: (trackId: number) => void
  /* Subtitles */
  subtitleTracks: SubtitleTrackInfo[]
  selectedSubtitleTrackId: number          // -1 = off
  onSubtitleTrackChange: (trackId: number) => void
  /* Quality */
  qualityOptions: QualityOption[]
  selectedQuality: string
  onQualityChange: (value: string) => void
  /* Variants (Audio Dubs) */
  variants?: { id: string; language: string }[]
  selectedVariantId?: string | null
  onVariantChange?: (variantId: string) => void
}

type PanelView = 'main' | 'audio' | 'subtitles' | 'quality'

/* ─── Language Utilities ──────────────────────────────────────────────────── */

const LANGUAGE_LABELS: Record<string, string> = {
  tam: 'Tamil', hin: 'Hindi', eng: 'English', tel: 'Telugu',
  mal: 'Malayalam', kan: 'Kannada', mar: 'Marathi', ben: 'Bengali',
  pan: 'Punjabi', guj: 'Gujarati', urd: 'Urdu', ori: 'Odia',
  jpn: 'Japanese', kor: 'Korean', spa: 'Spanish', fra: 'French',
  deu: 'German', ita: 'Italian', por: 'Portuguese', rus: 'Russian',
  ara: 'Arabic', zho: 'Chinese', tha: 'Thai', vie: 'Vietnamese',
  ind: 'Indonesian', msa: 'Malay', tur: 'Turkish', pol: 'Polish',
  nld: 'Dutch', swe: 'Swedish', nor: 'Norwegian', dan: 'Danish',
  fin: 'Finnish', ces: 'Czech', hun: 'Hungarian', ron: 'Romanian',
  ukr: 'Ukrainian', heb: 'Hebrew', fil: 'Filipino', und: 'Unknown',
}

function cleanLabel(track: { language: string; label: string }): string {
  // Prefer the human-readable label if it's meaningful
  if (track.label && track.label.length > 1 && track.label.toLowerCase() !== 'und') {
    return capitalize(track.label)
  }
  return LANGUAGE_LABELS[track.language.toLowerCase()] ?? capitalize(track.language)
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function PlayerSettingsPanel({
  audioTracks,
  selectedAudioTrackId,
  onAudioTrackChange,
  subtitleTracks,
  selectedSubtitleTrackId,
  onSubtitleTrackChange,
  qualityOptions,
  selectedQuality,
  onQualityChange,
  variants = [],
  selectedVariantId = null,
  onVariantChange,
}: PlayerSettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<PanelView>('main')
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setView('main')
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setView('main')
      }
    }
    if (isOpen) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen])

  const togglePanel = useCallback(() => {
    setIsOpen(prev => !prev)
    setView('main')
  }, [])

  const goBack = useCallback(() => setView('main'), [])

  const selectedAudioLabel = audioTracks.find(t => t.id === selectedAudioTrackId)
  const currentVariantLabel = variants.find(v => v.id === selectedVariantId)?.language
  const displayAudioLabel = currentVariantLabel || (selectedAudioLabel ? cleanLabel(selectedAudioLabel) : 'Default')

  const selectedSubLabel = selectedSubtitleTrackId === -1
    ? 'Off'
    : subtitleTracks.find(t => t.id === selectedSubtitleTrackId)

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={togglePanel}
        className="group relative inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white/90 backdrop-blur-md transition-all duration-200 hover:border-white/25 hover:bg-white/10 hover:text-white hover:shadow-lg"
        aria-label="Player Settings"
        id="player-settings-btn"
      >
        <Settings className="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" />
        <span className="hidden sm:inline">Settings</span>
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          className="absolute top-full right-0 z-[100] mt-2 w-72 origin-top-right animate-[fadeScaleDown_200ms_ease-out] rounded-xl border border-white/10 bg-[#1a1a24]/95 shadow-2xl backdrop-blur-xl sm:w-80"
          style={{ animationFillMode: 'forwards' }}
        >
          {/* ─── Main Menu ─── */}
          {view === 'main' && (
            <div className="py-1.5">
              <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
                <h3 className="text-sm font-bold text-white">Settings</h3>
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); setView('main') }}
                  className="rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close settings"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Audio */}
              {(audioTracks.length > 0 || variants.length > 1) && (
                <button
                  type="button"
                  onClick={() => setView('audio')}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  id="settings-audio-btn"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 text-blue-400">
                    <Volume2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">Audio</div>
                    <div className="truncate text-xs text-white/50 font-semibold text-[var(--mz-primary)]">
                      {displayAudioLabel}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>
              )}

              {/* Subtitles */}
              <button
                type="button"
                onClick={() => setView('subtitles')}
                className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                id="settings-subtitle-btn"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Subtitles className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">Subtitles</div>
                  <div className="truncate text-xs text-white/50">
                    {selectedSubtitleTrackId === -1
                      ? 'Off'
                      : selectedSubLabel && typeof selectedSubLabel !== 'string'
                        ? cleanLabel(selectedSubLabel)
                        : 'Off'}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
              </button>

              {/* Quality */}
              {qualityOptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => setView('quality')}
                  className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                  id="settings-quality-btn"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/15 text-purple-400">
                    <MonitorPlay className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">Quality</div>
                    <div className="truncate text-xs text-white/50">{selectedQuality}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
                </button>
              )}
            </div>
          )}

          {/* ─── Audio Sub-Panel ─── */}
          {view === 'audio' && (
            <SubPanel
              title="Audio Language"
              icon={<Volume2 className="h-4 w-4" />}
              iconBg="bg-blue-500/15 text-blue-400"
              onBack={goBack}
            >
              {variants.length > 0 ? (
                variants.map((v) => {
                  const isActive = v.id === selectedVariantId
                  return (
                    <TrackItem
                      key={v.id}
                      label={v.language}
                      isActive={isActive}
                      onClick={() => {
                        if (onVariantChange) onVariantChange(v.id)
                        setIsOpen(false)
                        setView('main')
                      }}
                    />
                  )
                })
              ) : (
                audioTracks.map((track) => {
                  const isActive = track.id === selectedAudioTrackId
                  return (
                    <TrackItem
                      key={track.id}
                      label={cleanLabel(track)}
                      isActive={isActive}
                      onClick={() => {
                        onAudioTrackChange(track.id)
                      }}
                    />
                  )
                })
              )}
            </SubPanel>
          )}

          {/* ─── Subtitle Sub-Panel ─── */}
          {view === 'subtitles' && (
            <SubPanel
              title="Subtitles"
              icon={<Subtitles className="h-4 w-4" />}
              iconBg="bg-emerald-500/15 text-emerald-400"
              onBack={goBack}
            >
              {/* Off option */}
              <TrackItem
                label="Off"
                isActive={selectedSubtitleTrackId === -1}
                onClick={() => onSubtitleTrackChange(-1)}
              />
              {subtitleTracks.map((track) => {
                const isActive = track.id === selectedSubtitleTrackId
                return (
                  <TrackItem
                    key={track.id}
                    label={cleanLabel(track)}
                    isActive={isActive}
                    onClick={() => onSubtitleTrackChange(track.id)}
                  />
                )
              })}
            </SubPanel>
          )}

          {/* ─── Quality Sub-Panel ─── */}
          {view === 'quality' && (
            <SubPanel
              title="Video Quality"
              icon={<MonitorPlay className="h-4 w-4" />}
              iconBg="bg-purple-500/15 text-purple-400"
              onBack={goBack}
            >
              {qualityOptions.map((opt) => (
                <TrackItem
                  key={opt.value}
                  label={opt.label}
                  isActive={opt.value === selectedQuality}
                  onClick={() => {
                    onQualityChange(opt.value)
                    setIsOpen(false)
                    setView('main')
                  }}
                />
              ))}
            </SubPanel>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function SubPanel({
  title,
  icon,
  iconBg,
  onBack,
  children,
}: {
  title: string
  icon: React.ReactNode
  iconBg: string
  onBack: () => void
  children: React.ReactNode
}) {
  return (
    <div className="py-1.5">
      <div className="flex items-center gap-2 border-b border-white/8 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="mr-1 rounded-md p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
          aria-label="Back"
        >
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${iconBg}`}>
          {icon}
        </div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
      </div>
      <div className="max-h-64 overflow-y-auto py-1">{children}</div>
    </div>
  )
}

function TrackItem({
  label,
  isActive,
  onClick,
}: {
  label: string
  isActive: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-white/5 ${
        isActive ? 'text-[var(--mz-primary)] font-semibold' : 'text-white/80 hover:text-white'
      }`}
    >
      <span className="truncate">{label}</span>
      {isActive && (
        <span className="ml-2 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mz-primary)]/20">
          <Check className="h-3 w-3 text-[var(--mz-primary)]" />
        </span>
      )}
    </button>
  )
}
