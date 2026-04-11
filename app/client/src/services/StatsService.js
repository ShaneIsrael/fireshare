import Api from './Api' // Uses axios setup with baseURL

const StatsService = {
  async getFolderSize() {
    try {
      const res = await Api().get('/api/folder-size') // No need for full localhost URL
      return res.data // Return raw data, let component decide how to use
    } catch (error) {
      console.error('Failed to fetch folder size:', error)
      throw error
    }
  },
  getGameScanStatus() {
    return Api().get('/api/scan-games/status')
  },
}

export default StatsService
