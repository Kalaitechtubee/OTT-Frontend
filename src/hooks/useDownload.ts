import { useState, useCallback } from 'react'
import { getDownloadV2 } from '@/services/api'
import { buildApiUrl } from '@/services/apiClient'
import type { V2Stream } from '@/types/v2'

export interface DownloadMetadata {
  title: string
  poster?: string | null
  year?: string
  runtime?: string | number | null
}

export interface ParsedStream {
  language: string
  quality: string
  url: string
  size: string
  codec: string
  originalQuality: string
}

// Helper to parse quality and language
export function parseQualityAndLanguage(qualityStr: string, defaultLanguage: string = 'English') {
  const str = qualityStr.trim()
  
  // Clean up specific composite prefixes first to prevent partial matches (e.g. "Original Audio" -> "Original")
  const compositePatterns = [
    { regex: /^Original\s+Audio\b/i, lang: defaultLanguage },
    { regex: /^Original\s*\/\s*Default\b/i, lang: defaultLanguage }
  ]
  
  for (const pattern of compositePatterns) {
    if (pattern.regex.test(str)) {
      const cleanQuality = str.replace(pattern.regex, '').trim()
      return {
        language: pattern.lang,
        quality: cleanQuality || 'Auto'
      }
    }
  }
  
  const knownLanguages = [
    'Tamil', 'Telugu', 'Hindi', 'English', 'Malayalam', 'Kannada', 
    'Bengali', 'Marathi', 'Punjabi', 'Spanish', 'French', 'German', 
    'Japanese', 'Korean', 'Original'
  ]
  
  for (const lang of knownLanguages) {
    const regex = new RegExp(`^${lang}\\b`, 'i')
    if (regex.test(str)) {
      const cleanQuality = str.replace(regex, '').trim()
      return {
        language: lang === 'Original' ? defaultLanguage : lang,
        quality: cleanQuality || 'Auto'
      }
    }
  }
  
  const alphaMatch = str.match(/^([a-zA-Z]+)\s+(.*)$/)
  if (alphaMatch) {
    return {
      language: alphaMatch[1],
      quality: alphaMatch[2]
    }
  }
  
  return {
    language: defaultLanguage,
    quality: str
  }
}

// Helper to estimate sizes and codecs dynamically
export function estimateStreamMeta(quality: string) {
  const cleanQ = quality.toLowerCase()
  if (cleanQ.includes('1080') || cleanQ.includes('fhd')) {
    return { size: '1.8 GB', codec: 'H265 / HEVC' }
  } else if (cleanQ.includes('720') || cleanQ.includes('hd')) {
    return { size: '980 MB', codec: 'H264' }
  } else if (cleanQ.includes('480') || cleanQ.includes('sd')) {
    return { size: '420 MB', codec: 'H264' }
  } else if (cleanQ.includes('2160') || cleanQ.includes('4k') || cleanQ.includes('uhd')) {
    return { size: '3.6 GB', codec: 'H265 / HEVC' }
  } else if (cleanQ.includes('360')) {
    return { size: '280 MB', codec: 'H264' }
  }
  return { size: '1.2 GB', codec: 'H264' }
}

export function useDownload() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedStreams, setParsedStreams] = useState<ParsedStream[]>([])
  const [languages, setLanguages] = useState<string[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedQuality, setSelectedQuality] = useState('')
  const [metadata, setMetadata] = useState<DownloadMetadata | null>(null)
  const [downloadProvider, setDownloadProvider] = useState<string | null>(null)
  const [downloadType, setDownloadType] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<{ provider: string; id: string; label?: string }[]>([])
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [currentParams, setCurrentParams] = useState<{
    tmdbId: string
    type: 'movie' | 'tv'
    season?: number
    episode?: number
    variant?: string
  } | null>(null)
  const [moviesdaStreams, setMoviesdaStreams] = useState<ParsedStream[]>([])
  const [movieswoodStreams, setMovieswoodStreams] = useState<ParsedStream[]>([])

  const loadProviderStreams = useCallback(async (
    provider: string,
    id: string,
    season?: number,
    episode?: number,
    variant?: string
  ) => {
    setLoading(true)
    setError(null)
    setParsedStreams([])
    setLanguages([])
    setSelectedLanguage('')
    setSelectedQuality('')
    setDownloadProvider(provider)
    setDownloadType(null)

    try {
      const result = await getDownloadV2(provider, id, season, episode, variant)
      if (!result.success || !result.streams || result.streams.length === 0) {
        throw new Error(`No download streams are available from ${provider}.`)
      }

      setDownloadProvider(result.provider || result.selectedProvider || provider)
      setDownloadType(result.streamType || (result.stream as any)?.streamType || 'native')

      // Map raw streams to ParsedStreams
      const mapped: ParsedStream[] = result.streams.map((s: V2Stream) => {
        const { language, quality } = parseQualityAndLanguage(s.quality)
        const { size, codec } = estimateStreamMeta(quality)
        return {
          language,
          quality,
          url: s.url,
          size,
          codec,
          originalQuality: s.quality
        }
      })

      // Get unique languages
      const uniqueLangs = Array.from(new Set(mapped.map(s => s.language)))
      
      setParsedStreams(mapped)
      setLanguages(uniqueLangs)
      
      // Auto-select first language and quality if available
      if (uniqueLangs.length > 0) {
        const defaultLang = uniqueLangs.includes('English') ? 'English' : uniqueLangs[0]
        setSelectedLanguage(defaultLang)
        
        const langStreams = mapped.filter(s => s.language === defaultLang)
        if (langStreams.length > 0) {
          setSelectedQuality(langStreams[0].originalQuality)
        }
      }
    } catch (err) {
      console.error(`[useDownload] Fetch failed for ${provider}:`, err)
      setError(err instanceof Error ? err.message : `Failed to retrieve download configurations for ${provider}.`)
    } finally {
      setLoading(false)
    }
  }, [])
  
  const openDownload = useCallback(async (
    tmdbId: string,
    type: 'movie' | 'tv',
    meta: DownloadMetadata,
    season?: number,
    episode?: number,
    variant?: string,
    _sources: { provider: string; id: string; label?: string }[] = []
  ) => {
    setIsOpen(true)
    setLoading(true)
    setError(null)
    setParsedStreams([])
    setLanguages([])
    setSelectedLanguage('')
    setSelectedQuality('')
    setDownloadProvider(null)
    setDownloadType(null)
    setMetadata(meta)
    setCurrentParams({ tmdbId, type, season, episode, variant })
    setMoviesdaStreams([])
    setMovieswoodStreams([])

    // Fetch scraper downloads in parallel for movies
    let moviesdaList: ParsedStream[] = []
    let movieswoodList: ParsedStream[] = []

    if (type === 'movie') {
      try {
        const queryTitle = meta.title.split(' (')[0].trim()
        const queryYear = meta.year ? meta.year.split('-')[0].trim() : ''

        const fetchMoviesda = async () => {
          try {
            const url = buildApiUrl('/api/moviesda/download', {
              title: queryTitle,
              ...(queryYear && { year: queryYear })
            })
            const mRes = await fetch(url).then(res => res.json())
            if (mRes.ok && mRes.found && mRes.qualities) {
              for (const q of mRes.qualities) {
                for (const f of q.files) {
                  const targetUrl = f.downloadUrl || f.watchUrl
                  if (targetUrl) {
                    const resMatch = f.name.match(/(\d{3,4}p)/i)
                    const fileResolution = resMatch ? resMatch[1].toUpperCase() : null
                    const rawQuality = fileResolution || f.quality || q.label || q.quality || '720p'
                    const cleanQ = rawQuality.replace(/hd|original|rip/gi, '').trim() || '720p'
                    moviesdaList.push({
                      language: 'Tamil (Local)',
                      quality: cleanQ,
                      url: targetUrl,
                      size: f.size || '980 MB',
                      codec: f.format ? f.format.toUpperCase() : 'MP4',
                      originalQuality: `${rawQuality} - ${f.name}`
                    })
                  }
                }
              }
            }
          } catch (e) {
            console.error('[Moviesda Scraper] Failed to fetch:', e)
          }
        }

        const fetchMovieswood = async () => {
          try {
            const url = buildApiUrl('/api/movieswood/download', {
              title: queryTitle,
              ...(queryYear && { year: queryYear })
            })
            const mRes = await fetch(url).then(res => res.json())
            if (mRes.ok && mRes.found && mRes.qualities) {
              for (const q of mRes.qualities) {
                for (const f of q.files) {
                  const targetUrl = f.watchUrl || f.downloadUrl
                  if (targetUrl) {
                    const resMatch = f.name.match(/(\d{3,4}p)/i)
                    const fileResolution = resMatch ? resMatch[1].toUpperCase() : null
                    const rawQuality = fileResolution || f.quality || q.label || q.quality || '720p'
                    const cleanQ = rawQuality.replace(/hd|original|rip/gi, '').trim() || '720p'
                    
                    // Dynamically parse audio language from file name
                    let fileLang = 'Local'
                    const lowerName = f.name.toLowerCase()
                    if (lowerName.includes('tamil')) {
                      fileLang = 'Tamil'
                    } else if (lowerName.includes('telugu')) {
                      fileLang = 'Telugu'
                    } else if (lowerName.includes('hindi')) {
                      fileLang = 'Hindi'
                    } else if (lowerName.includes('kannada')) {
                      fileLang = 'Kannada'
                    } else if (lowerName.includes('malayalam')) {
                      fileLang = 'Malayalam'
                    } else if (lowerName.includes('english') || lowerName.includes('eng')) {
                      fileLang = 'English'
                    }

                    movieswoodList.push({
                      language: fileLang,
                      quality: cleanQ,
                      url: targetUrl,
                      size: f.size || '1.40 GB',
                      codec: f.format ? f.format.toUpperCase() : 'MKV',
                      originalQuality: `${rawQuality} - ${f.name}`
                    })
                  }
                }
              }
            }
          } catch (e) {
            console.error('[Movieswood Scraper] Failed to fetch:', e)
          }
        }

        await Promise.all([fetchMoviesda(), fetchMovieswood()])
      } catch (e) {
        console.error('[Scraper parallel fetch] failed:', e)
      }
    }

    setMoviesdaStreams(moviesdaList)
    setMovieswoodStreams(movieswoodList)

    const updatedSources = []
    if (movieswoodList.length > 0) {
      updatedSources.push({
        provider: 'movieswood',
        id: tmdbId,
        label: 'Movieswood Scraper 🪵'
      })
    }
    if (moviesdaList.length > 0) {
      updatedSources.push({
        provider: 'moviesda',
        id: tmdbId,
        label: 'Moviesda Scraper 🐯'
      })
    }
    setAvailableProviders(updatedSources)

    try {
      let defaultProvider = null
      let defaultStreams: ParsedStream[] = []

      if (movieswoodList.length > 0) {
        defaultProvider = 'movieswood'
        defaultStreams = movieswoodList
      } else if (moviesdaList.length > 0) {
        defaultProvider = 'moviesda'
        defaultStreams = moviesdaList
      }

      if (defaultProvider) {
        setDownloadProvider(defaultProvider)
        setActiveProvider(defaultProvider)
        setDownloadType('scraper')
        setParsedStreams(defaultStreams)

        const uniqueLangs = Array.from(new Set(defaultStreams.map(s => s.language)))
        setLanguages(uniqueLangs)
        if (uniqueLangs.length > 0) {
          setSelectedLanguage(uniqueLangs[0])
          const langStreams = defaultStreams.filter(s => s.language === uniqueLangs[0])
          if (langStreams.length > 0) {
            setSelectedQuality(langStreams[0].originalQuality)
          }
        }
      } else {
        throw new Error('No download streams are available for this title.')
      }
    } catch (err) {
      console.error('[useDownload] Fetch failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to retrieve download configurations.')
    } finally {
      setLoading(false)
    }
  }, [])
 
  const closeDownload = useCallback(() => {
    setIsOpen(false)
    setError(null)
    setParsedStreams([])
    setLanguages([])
    setSelectedLanguage('')
    setSelectedQuality('')
    setDownloadProvider(null)
    setDownloadType(null)
    setMetadata(null)
    setCurrentParams(null)
    setAvailableProviders([])
    setActiveProvider(null)
    setMoviesdaStreams([])
    setMovieswoodStreams([])
  }, [])
 
  const retry = useCallback(() => {
    if (currentParams && metadata) {
      void openDownload(
        currentParams.tmdbId,
        currentParams.type,
        metadata,
        currentParams.season,
        currentParams.episode,
        currentParams.variant,
        availableProviders
      )
    }
  }, [currentParams, metadata, openDownload, availableProviders])

  const selectProvider = useCallback(async (providerName: string) => {
    if (!currentParams) return
    const targetSource = availableProviders.find(p => p.provider === providerName)
    if (!targetSource) return

    setActiveProvider(providerName)
    if (providerName === 'moviesda' || providerName === 'movieswood') {
      const targetStreams = providerName === 'moviesda' ? moviesdaStreams : movieswoodStreams
      setDownloadProvider(providerName)
      setDownloadType('scraper')
      setParsedStreams(targetStreams)

      const uniqueLangs = Array.from(new Set(targetStreams.map(s => s.language)))
      setLanguages(uniqueLangs)
      if (uniqueLangs.length > 0) {
        setSelectedLanguage(uniqueLangs[0])
        const langStreams = targetStreams.filter(s => s.language === uniqueLangs[0])
        if (langStreams.length > 0) {
          setSelectedQuality(langStreams[0].originalQuality)
        }
      }
    } else {
      await loadProviderStreams(
        providerName,
        targetSource.id,
        currentParams.season,
        currentParams.episode,
        currentParams.variant
      )
    }
  }, [availableProviders, currentParams, loadProviderStreams, moviesdaStreams, movieswoodStreams])
 
  const selectLanguage = useCallback((lang: string) => {
    setSelectedLanguage(lang)
    // Reset quality to first available in this language
    const langStreams = parsedStreams.filter(s => s.language === lang)
    if (langStreams.length > 0) {
      setSelectedQuality(langStreams[0].originalQuality)
    } else {
      setSelectedQuality('')
    }
  }, [parsedStreams])
 
  const selectQuality = useCallback((quality: string) => {
    setSelectedQuality(quality)
  }, [])
 
  const triggerDownload = useCallback(() => {
    const activeStream = parsedStreams.find(
      s => s.language === selectedLanguage && s.originalQuality === selectedQuality
    )
    if (!activeStream) return
 
    // Trigger direct native browser download
    window.location.assign(activeStream.url)
 
    // Trigger toast notification
    setToast('Download started. Check your browser downloads.')
    setTimeout(() => setToast(null), 4000)
 
    // Close the modal
    closeDownload()
  }, [parsedStreams, selectedLanguage, selectedQuality, closeDownload])
 
  return {
    isOpen,
    loading,
    error,
    languages,
    parsedStreams,
    selectedLanguage,
    selectedQuality,
    metadata,
    downloadProvider,
    downloadType,
    availableProviders,
    activeProvider,
    toast,
    currentParams,
    openDownload,
    closeDownload,
    selectLanguage,
    selectQuality,
    selectProvider,
    triggerDownload,
    retry
  }
}
