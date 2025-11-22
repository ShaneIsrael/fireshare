import React from 'react'

let isLocalhost = (window.location.hostname.indexOf('localhost') >= 0 || window.location.hostname.indexOf('127.0.0.1') >= 0) && window.location.port !== '';
export const getServedBy = () => {
  return isLocalhost
    ? 'flask'
    : 'nginx'
}

export const getUrl = () => {
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return isLocalhost
    ? `http://${window.location.hostname}:${process.env.REACT_APP_SERVER_PORT || window.location.port}`
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}`
}

export const getPublicWatchUrl = () => {
  const shareableLinkDomain = getSetting('ui_config')?.['shareable_link_domain']
  if (shareableLinkDomain) {
    return `${shareableLinkDomain}/w/`
  }
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return isLocalhost
    ? `http://${window.location.hostname}:${process.env.REACT_APP_SERVER_PORT || window.location.port}/#/w/`
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

export const getSettings = () => localStorage.getItem('config') && JSON.parse(localStorage.getItem('config'))
export const getSetting = (setting) =>
  localStorage.getItem('config') && JSON.parse(localStorage.getItem('config'))[setting]
export const setSettings = (settings) => localStorage.setItem('config', JSON.stringify(settings))
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
    console.log('test')
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
 * Gets the URL for a specific video quality
 * @param {string} videoId - The video ID
 * @param {string} quality - Quality ('720p', '1080p', or 'original')
 * @param {string} extension - Video file extension (e.g., '.mp4', '.mkv')
 * @returns {string} Video URL
 */
export const getVideoUrl = (videoId, quality, extension) => {
  const URL = getUrl()
  const SERVED_BY = getServedBy()
  
  if (quality === '720p' || quality === '1080p') {
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
 * Generates video sources array for Video.js player with quality options
 * Defaults to original quality, with 720p and 1080p as alternatives
 * @param {string} videoId - The video ID
 * @param {Object} videoInfo - Video info object containing has_720p, has_1080p flags
 * @param {string} extension - Video file extension (e.g., '.mp4', '.mkv')
 * @returns {Array} Array of video sources for Video.js
 */
export const getVideoSources = (videoId, videoInfo, extension) => {
  const sources = []
  
  const has720p = videoInfo?.has_720p
  const has1080p = videoInfo?.has_1080p
  
  // Add 720p
  if (has720p) {
    sources.push({
      src: getVideoUrl(videoId, '720p', extension),
      type: 'video/mp4',
      label: '720p',
    })
  }
  
  // Add 1080p
  if (has1080p) {
    sources.push({
      src: getVideoUrl(videoId, '1080p', extension),
      type: 'video/mp4',
      label: '1080p',
    })
  }

  // Add original quality - always selected by default
  sources.push({
    src: getVideoUrl(videoId, 'original', extension),
    type: 'video/mp4',
    label: 'Original',
    selected: true, // Always default to original quality
  })

  return sources
}
