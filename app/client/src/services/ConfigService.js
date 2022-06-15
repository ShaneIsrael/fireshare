import Api from './Api'

const service = {
  getConfig() {
    return Api().get('/api/config')
  },
}

export default service
