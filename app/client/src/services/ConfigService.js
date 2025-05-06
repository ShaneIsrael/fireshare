import Api from './Api'

const service = {
  getConfig() {
    return Api().get('/api/config')
  },
  getAdminConfig() {
    return Api().get('/api/admin/config')
  },
  updateConfig(config) {
    return Api().put('/api/admin/config', {
      config,
    })
  },
}

export default service
