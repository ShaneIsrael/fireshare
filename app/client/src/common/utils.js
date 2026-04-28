import React from 'react'

let isLocalhost =
  (window.location.hostname.indexOf('localhost') >= 0 || window.location.hostname.indexOf('127.0.0.1') >= 0) &&
  window.location.port !== ''
export const getServedBy = () => {
  // When running `vite` over LAN IP, hostname is not localhost
  // but static content is still served by the dev server proxy, not nginx.
  const isDevClient = process.env.NODE_ENV === 'development' && window.location.port !== ''
  return isLocalhost || isDevClient ? 'flask' : 'nginx'
}

export const getUrl = () => {
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return isLocalhost
    ? `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT || window.location.port}`
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}`
}

export const getPublicWatchUrl = () => {
  const shareableLinkDomain = getSetting('ui_config')?.['shareable_link_domain']
  if (shareableLinkDomain) {
    return `${shareableLinkDomain}/w/`
  }
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return isLocalhost
    ? `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT || window.location.port}/w/`
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}/w/`
}

export const getVideoPath = (id, extension) => {
  if (extension === '.mkv') {
    return `${id}-1.mp4`
  }
  return `${id}${extension}`
}

export const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = React.useState(value)

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export const getSetting = (setting) =>
  localStorage.getItem('config') && JSON.parse(localStorage.getItem('config'))[setting]
export const setSetting = (setting, value) => {
  if (localStorage.getItem('config')) {
    const settings = JSON.parse(localStorage.getItem('config'))
    localStorage.setItem('config', JSON.stringify({ ...settings, [setting]: value }))
  } else {
    localStorage.setItem('config', JSON.stringify({ [setting]: value }))
  }
}

export const toHHMMSS = (secs) => {
  var sec_num = parseInt(secs, 10)
  var hours = Math.floor(sec_num / 3600)
  var minutes = Math.floor(sec_num / 60) % 60
  var seconds = sec_num % 60

  return [hours, minutes, seconds]
    .map((v) => (v < 10 ? '0' + v : v))
    .filter((v, i) => v !== '00' || i > 0)
    .join(':')
}

export const copyToClipboard = (textToCopy) => {
  // navigator clipboard api needs a secure context (https)
  if (navigator.clipboard && window.isSecureContext) {
    // navigator clipboard api method'
    return navigator.clipboard.writeText(textToCopy)
  } else {
    // text area method
    let textArea = document.createElement('textarea')
    textArea.value = textToCopy
    // make the textarea out of viewport
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    return new Promise((res, rej) => {
      // here the magic happens
      document.execCommand('copy') ? res() : rej()
      textArea.remove()
    })
  }
}

/**
 * Gets the URL for a video's poster/thumbnail image.
 * When served by nginx, uses a static route that tries custom_poster.webp first, then poster.jpg.
 * @param {string} videoId - The video ID
 * @param {string|number} [cacheBuster] - Optional cache-busting value appended as a query param
 * @returns {string} Poster URL
 */
export const getPosterUrl = (videoId, cacheBuster) => {
  const baseUrl = getUrl()
  const SERVED_BY = getServedBy()
  if (SERVED_BY === 'nginx') {
    const url = `${baseUrl}/_content/derived/${videoId}/thumbnail`
    return cacheBuster ? `${url}?v=${cacheBuster}` : url
  }
  const url = `${baseUrl}/api/video/poster?id=${videoId}`
  return cacheBuster ? `${url}&v=${cacheBuster}` : url
}

/**
 * Gets the URL for a specific video quality
 * @param {string} videoId - The video ID
 * @param {string} quality - Quality ('720p', '1080p', or 'original')
 * @param {string} extension - Video file extension (e.g., '.mp4', '.mkv')
 * @returns {string} Video URL
 */
export const getVideoUrl = (videoId, quality, extension) => {
  const URL = getUrl()
  const SERVED_BY = getServedBy()

  if (quality === '480p' || quality === '720p' || quality === '1080p') {
    if (SERVED_BY === 'nginx') {
      return `${URL}/_content/derived/${videoId}/${videoId}-${quality}.mp4`
    }
    return `${URL}/api/video?id=${videoId}&quality=${quality}`
  }

  // Original quality
  if (SERVED_BY === 'nginx') {
    const videoPath = getVideoPath(videoId, extension)
    return `${URL}/_content/video/${videoPath}`
  }
  return `${URL}/api/video?id=${extension === '.mkv' ? `${videoId}&subid=1` : videoId}`
}

/**
 * Gets the public share URL for an image (/i/<image_id>)
 * @returns {string} Base URL ending with /i/
 */
export const getPublicImageUrl = () => {
  const shareableLinkDomain = getSetting('ui_config')?.['shareable_link_domain']
  if (shareableLinkDomain) {
    return `${shareableLinkDomain}/i/`
  }
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return isLocalhost
    ? `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT || window.location.port}/i/`
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}/i/`
}

/**
 * Gets the URL for a game asset (hero, banner, logo, icon).
 * In nginx/prod mode uses /_content/game_assets/; in dev uses /api/game/assets/.
 * @param {number} steamgriddbId - SteamGridDB game ID
 * @param {string} slot - Asset slot name, e.g. 'hero_1', 'logo_1', 'icon_1'
 * @param {string|number} [cacheBuster] - Optional cache-busting value
 * @returns {string} Asset URL
 */
export const getGameAssetUrl = (steamgriddbId, slot, cacheBuster) => {
  const SERVED_BY = getServedBy()
  const base =
    SERVED_BY === 'nginx'
      ? `/_content/game_assets/${steamgriddbId}`
      : `/api/game/assets/${steamgriddbId}`
  const url = `${base}/${slot}.webp`
  return cacheBuster ? `${url}?v=${cacheBuster}` : url
}

/**
 * Gets the thumbnail URL for an image
 */
export const getImageThumbnailUrl = (imageId, cacheBuster) => {
  const baseUrl = getUrl()
  const SERVED_BY = getServedBy()
  if (SERVED_BY === 'nginx') {
    const url = `${baseUrl}/_content/derived/${imageId}/thumbnail.webp`
    return cacheBuster ? `${url}?v=${cacheBuster}` : url
  }
  const url = `${baseUrl}/api/image/thumbnail?id=${imageId}`
  return cacheBuster ? `${url}&v=${cacheBuster}` : url
}

/**
 * Gets the full-quality URL for an image
 */
export const getImageUrl = (imageId) => {
  const baseUrl = getUrl()
  const SERVED_BY = getServedBy()
  if (SERVED_BY === 'nginx') {
    return `${baseUrl}/_content/derived/${imageId}/image.webp`
  }
  return `${baseUrl}/api/image?id=${imageId}`
}

/**
 * Generates video sources array for Video.js player with quality options
 * Defaults to original quality, with 720p and 1080p as alternatives
 * @param {string} videoId - The video ID
 * @param {Object} videoInfo - Video info object containing has_720p, has_1080p flags
 * @param {string} extension - Video file extension (e.g., '.mp4', '.mkv')
 * @returns {Array} Array of video sources for Video.js
 */
export const getVideoSources = (videoId, videoInfo, extension) => {
  const sources = []
  const URL = getUrl()
  const SERVED_BY = getServedBy()

  const has480p = videoInfo?.has_480p
  const has720p = videoInfo?.has_720p
  const has1080p = videoInfo?.has_1080p
  const hasCrop = videoInfo?.has_crop

  // When a cropped version exists, point "Source" at the cropped file instead of the original
  const sourceUrl = hasCrop
    ? SERVED_BY === 'nginx'
      ? `${URL}/_content/derived/${videoId}/${videoId}-cropped.mp4`
      : `${URL}/api/video?id=${videoId}&quality=cropped`
    : getVideoUrl(videoId, 'original', extension)

  sources.push({
    src: sourceUrl,
    type: 'video/mp4',
    label: 'Source',
    selected: true,
  })

  if (has1080p) {
    sources.push({
      src: getVideoUrl(videoId, '1080p', extension),
      type: 'video/mp4',
      label: '1080p',
    })
  }

  if (has720p) {
    sources.push({
      src: getVideoUrl(videoId, '720p', extension),
      type: 'video/mp4',
      label: '720p',
    })
  }

  if (has480p) {
    sources.push({
      src: getVideoUrl(videoId, '480p', extension),
      type: 'video/mp4',
      label: '480p',
    })
  }

  return sources
}

export const formatSize = (bytes) => {
  if (bytes == null || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

export const formatTableDate = (isoString) => {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

export const formatDuration = (seconds) => {
  if (seconds == null || isNaN(seconds)) return '—'
  const s = Math.floor(seconds)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

export const formatResolution = (width, height) => {
  if (!width || !height) return '—'
  const shortSide = Math.min(width, height)
  if (shortSide >= 2160) return '4K'
  if (shortSide >= 1440) return '1440p'
  if (shortSide >= 1080) return '1080p'
  if (shortSide >= 720) return '720p'
  if (shortSide >= 480) return '480p'
  return `${width}×${height}`
}
