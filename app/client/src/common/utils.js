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

export const getSettings = () => JSON.parse(localStorage.getItem('settings'))
export const setSettings = (settings) => localStorage.setItem('settings', JSON.stringify(settings))
export const setSetting = (setting) => {
  const settings = JSON.parse(localStorage.getItem('settings'))
  if (settings) {
    localStorage.setItem('settings', JSON.stringify({ ...settings, ...setting }))
  } else {
    localStorage.setItem('settings', JSON.stringify(setting))
  }
}
