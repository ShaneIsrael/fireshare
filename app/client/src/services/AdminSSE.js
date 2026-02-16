import { getUrl } from '../common/utils'

class AdminSSEManager {
  constructor() {
    this.eventSource = null
    this.transcodingSubscribers = new Set()
    this.lastTranscodingStatus = null
  }

  subscribeTranscoding(callback) {
    this.transcodingSubscribers.add(callback)
    if (!this.eventSource) this.connect()
    if (this.lastTranscodingStatus) callback(this.lastTranscodingStatus)
    return () => {
      this.transcodingSubscribers.delete(callback)
      if (this.transcodingSubscribers.size === 0) this.disconnect()
    }
  }

  connect() {
    this.eventSource = new EventSource(
      `${getUrl()}/api/admin/stream`,
      { withCredentials: true }
    )

    this.eventSource.addEventListener('transcoding', (e) => {
      const data = JSON.parse(e.data)
      if (data.is_running && !this.lastTranscodingStatus?.is_running) {
        window.dispatchEvent(new CustomEvent('transcodingStarted'))
      }
      this.lastTranscodingStatus = data
      this.transcodingSubscribers.forEach(cb => cb(data))
    })

    // Future admin events can be added here:
    // this.eventSource.addEventListener('other_event', (e) => { ... })
  }

  disconnect() {
    this.eventSource?.close()
    this.eventSource = null
    this.lastTranscodingStatus = null
  }
}

export default new AdminSSEManager()
