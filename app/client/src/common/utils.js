export const getUrl = () => {
  return window.location.hostname.indexOf('localhost') >= 0
    ? 'http://localhost:5000'
    : `${window.location.protocol}//${window.location.hostname}`
}
export const getPublicWatchUrl = () => {
  return window.location.hostname.indexOf('localhost') >= 0
    ? 'http://localhost:3000/#/w/'
    : `${window.location.protocol}//${window.location.hostname}/#/w/`
}
