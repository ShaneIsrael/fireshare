import Api from './Api'

const service = {
  getReleases(offset = 0, limit = 3) {
    return Api().get('/api/releases', { params: { offset, limit } })
  },
  setLastSeenVersion(version) {
    return Api().put('/api/user/last-seen-version', { version })
  },
}

export default service
