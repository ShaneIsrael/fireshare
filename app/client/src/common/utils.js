import React from 'react'

export const getServedBy = () => {
  return window.location.port === 3000 ||
    (window.location.hostname.indexOf('localhost') >= 0 && window.location.port !== '')
    ? 'flask'
    : 'nginx'
}

export const getUrl = () => {
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return window.location.port === 3000 ||
    (window.location.hostname.indexOf('localhost') >= 0 && window.location.port !== '')
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}`
}
export const getPublicWatchUrl = () => {
  const shareableLinkDomain = getSetting('ui_config')['shareable_link_domain']
  if (shareableLinkDomain) {
    return `${shareableLinkDomain}/w/`
  }
  const portWithColon = window.location.port ? `:${window.location.port}` : ''
  return window.location.port === 3000 ||
    (window.location.hostname.indexOf('localhost') >= 0 && window.location.port !== '')
    ? `http://localhost:${window.location.port}/#/w/`
    : `${window.location.protocol}//${window.location.hostname}${portWithColon}/w/`
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
