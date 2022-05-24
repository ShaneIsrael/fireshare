import Api from './Api'

export default {
  getVideos() {
    return Api().get('/api/videos')
  },
  getDetails(id) {
    return Api().get('/api/video/details', {
      params: {
        id,
      },
    })
  },
}
