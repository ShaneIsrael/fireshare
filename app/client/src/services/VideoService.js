import Api from './Api'

const service = {
  getVideos() {
    return Api().get('/api/videos')
  },
  getDetails(id) {
    return Api().get(`/api/video/details/${id}`)
  },
  updateTitle(id, title) {
    return Api().put(`/api/video/details/${id}`, {
      title,
    })
  },
  scan() {
    return Api().get('/api/manual/scan')
  },
}

export default service
