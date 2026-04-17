import Api from './Api'

const service = {
  getReleaseNotes() {
    return Api().get('/api/release-notes')
  },
  getReleases(offset = 0, limit = 3) {
    return Api().get('/api/releases', { params: { offset, limit } })
  },
  setLastSeenVersion(version) {
    return Api().put('/api/user/last-seen-version', { version })
  },
}

export default service
