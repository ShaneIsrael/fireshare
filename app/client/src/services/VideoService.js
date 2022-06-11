import Api from './Api'

const service = {
  getVideos(sort) {
    return Api().get('/api/videos', {
      params: {
        sort,
      },
    })
  },
  getPublicVideos(sort) {
    return Api().get('/api/videos/public', {
      params: {
        sort,
      },
    })
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
  delete(id) {
    return Api().delete(`/api/video/delete/${id}`)
  },
  scan() {
    return Api().get('/api/manual/scan')
  },
}

export default service
