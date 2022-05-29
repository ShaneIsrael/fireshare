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

export const getSettings = () => localStorage.getItem('settings') && JSON.parse(localStorage.getItem('settings'))
export const getSetting = (setting) =>
  localStorage.getItem('settings') && JSON.parse(localStorage.getItem('settings'))[setting]
export const setSettings = (settings) => localStorage.setItem('settings', JSON.stringify(settings))
export const setSetting = (setting, value) => {
  if (localStorage.getItem('settings')) {
    const settings = localStorage.getItem('settings')
    localStorage.setItem('settings', JSON.stringify({ ...settings, [setting]: value }))
  } else {
    localStorage.setItem('settings', JSON.stringify({ [setting]: value }))
  }
}
