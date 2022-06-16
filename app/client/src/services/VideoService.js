import Api from './Api'

const service = {
  getVideos() {
    return Api().get('/api/videos')
  },
  getPublicVideos() {
    return Api().get('/api/videos/public')
  },
  getDetails(id) {
    return Api().get(`/api/video/details/${id}`)
  },
  getRandomVideo() {
    return Api().get('/api/video/random')
  },
  getRandomPublicVideo() {
    return Api().get('/api/video/public/random')
  },
  updateTitle(id, title) {
    return Api().put(`/api/video/details/${id}`, {
      title,
    })
  },
  updatePrivacy(id, value) {
    return Api().put(`/api/video/details/${id}`, {
      private: value,
    })
  },
  updateDetails(id, details) {
    return Api().put(`/api/video/details/${id}`, {
      ...details,
    })
  },
  scan() {
    return Api().get('/api/manual/scan')
  },
  upload(file) {
    return Api().post('/api/upload', file)
  }
}

export default service
