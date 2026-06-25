import { useState, useCallback } from 'react'
import { fetchDownloadDetails } from '@/services/downloadApi'
import { getDownloadV2 } from '@/services/api'
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
          setSelectedQuality(langStreams[0].quality)
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
    sources: { provider: string; id: string; label?: string }[] = []
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
    setAvailableProviders(sources)
    setCurrentParams({ tmdbId, type, season, episode, variant })
 
    try {
      const result = await fetchDownloadDetails(tmdbId, type, season, episode, variant)
      if (!result.success || !result.streams || result.streams.length === 0) {
        throw new Error('No download streams are available for this title.')
      }
 
      const resolvedProvider = result.provider || result.selectedProvider || null
      setDownloadProvider(resolvedProvider)
      setActiveProvider(resolvedProvider)
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
          setSelectedQuality(langStreams[0].quality)
        }
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
    await loadProviderStreams(
      providerName,
      targetSource.id,
      currentParams.season,
      currentParams.episode,
      currentParams.variant
    )
  }, [availableProviders, currentParams, loadProviderStreams])
 
  const selectLanguage = useCallback((lang: string) => {
    setSelectedLanguage(lang)
    // Reset quality to first available in this language
    const langStreams = parsedStreams.filter(s => s.language === lang)
    if (langStreams.length > 0) {
      setSelectedQuality(langStreams[0].quality)
    } else {
      setSelectedQuality('')
    }
  }, [parsedStreams])
 
  const selectQuality = useCallback((quality: string) => {
    setSelectedQuality(quality)
  }, [])
 
  const triggerDownload = useCallback(() => {
    const activeStream = parsedStreams.find(
      s => s.language === selectedLanguage && s.quality === selectedQuality
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
    openDownload,
    closeDownload,
    selectLanguage,
    selectQuality,
    selectProvider,
    triggerDownload,
    retry
  }
}
