import { getUrl } from '../common/utils'

const getAdminStreamBaseUrl = () => {
  const isLocalhost =
    (window.location.hostname.indexOf('localhost') >= 0 || window.location.hostname.indexOf('127.0.0.1') >= 0) &&
    window.location.port !== ''
  if (isLocalhost) {
    return `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT || '3001'}`
  }
  return getUrl()
}

class AdminSSEManager {
  constructor() {
    this.eventSource = null
    this.transcodingSubscribers = new Set()
    this.lastTranscodingStatus = null
    this.gameScanSubscribers = new Set()
    this.lastGameScanStatus = null
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRANSCODING
  // ═══════════════════════════════════════════════════════════════════════════

  subscribeTranscoding(callback) {
    this.transcodingSubscribers.add(callback)
    if (!this.eventSource) this.connect()
    if (this.lastTranscodingStatus) callback(this.lastTranscodingStatus)
    return () => {
      this.transcodingSubscribers.delete(callback)
      if (this.transcodingSubscribers.size === 0 && this.gameScanSubscribers.size === 0) this.disconnect()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GAME SCAN
  // ═══════════════════════════════════════════════════════════════════════════

  subscribeGameScan(callback) {
    this.gameScanSubscribers.add(callback)
    if (!this.eventSource) this.connect()
    if (this.lastGameScanStatus) callback(this.lastGameScanStatus)
    return () => {
      this.gameScanSubscribers.delete(callback)
      if (this.transcodingSubscribers.size === 0 && this.gameScanSubscribers.size === 0) this.disconnect()
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONNECTION
  // ═══════════════════════════════════════════════════════════════════════════

  connect() {
    this.eventSource = new EventSource(`${getAdminStreamBaseUrl()}/api/admin/stream`, { withCredentials: true })

    this.eventSource.addEventListener('transcoding', (e) => {
      const data = JSON.parse(e.data)
      if (data.is_running && !this.lastTranscodingStatus?.is_running) {
        window.dispatchEvent(new CustomEvent('transcodingStarted'))
      }
      this.lastTranscodingStatus = data
      this.transcodingSubscribers.forEach((cb) => cb(data))
    })

    this.eventSource.addEventListener('gameScan', (e) => {
      const data = JSON.parse(e.data)
      this.lastGameScanStatus = data
      this.gameScanSubscribers.forEach((cb) => cb(data))
    })
  }

  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
    this.lastTranscodingStatus = null
    this.lastGameScanStatus = null
  }
}

const adminSSE = new AdminSSEManager()

export default adminSSE
