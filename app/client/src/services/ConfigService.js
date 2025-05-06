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

  // Adding the new methods:
  getAdminConfigUpdated() {
    return Api().get('/api/config')  // Adjusted to match the new method
  },

  updateConfigUpdated(updatedConfig) {
    return Api().put('/api/config', updatedConfig)  // Adjusted to match the new method
  }
}

export default service
