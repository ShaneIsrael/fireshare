import Api from './Api'

export default {
  getDetails(id) {
    return Api().get('/api/video/details', {
      params: {
        id,
      },
    })
  },
}
