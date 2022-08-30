import Api from './Api'

const service = {
  getAdminWarnings() {
    return Api().get('/api/admin/warnings')
  },
}

export default service
