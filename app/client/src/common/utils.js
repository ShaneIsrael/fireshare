import React from 'react'

export const getServedBy = () => {
  return window.location.port === 3000 && window.location.hostname.indexOf('localhost') >= 0 ? 'flask' : 'nginx'
}

export const getUrl = () => {
  return window.location.port === 3000 && window.location.hostname.indexOf('localhost') >= 0
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}`
}
export const getPublicWatchUrl = () => {
  return window.location.port === 3000 && window.location.hostname.indexOf('localhost') >= 0
    ? 'http://localhost:3000/#/w/'
    : `${window.location.protocol}//${window.location.hostname}/#/w/`
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
