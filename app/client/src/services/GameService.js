import Api from './Api'

const service = {
  searchSteamGrid(query) {
    return Api().get('/api/steamgrid/search', {
      params: {
        query,
      },
    })
  },
  getGameAssets(gameId) {
    return Api().get(`/api/steamgrid/game/${gameId}/assets`)
  },
  getGames() {
    return Api().get('/api/games')
  },
  getGameVideos(gameId) {
    return Api().get(`/api/games/${gameId}/videos`)
  },
  createGame(gameData) {
    return Api().post('/api/games', gameData)
  },
  linkVideoToGame(videoId, gameId) {
    return Api().post(`/api/videos/${videoId}/game`, {
      game_id: gameId,
    })
  },
  getVideoGame(videoId) {
    return Api().get(`/api/videos/${videoId}/game`)
  },
  unlinkVideoFromGame(videoId) {
    return Api().delete(`/api/videos/${videoId}/game`)
  },
  deleteGame(gameId, deleteVideos = false) {
    return Api().delete(`/api/games/${gameId}`, {
      params: {
        delete_videos: deleteVideos,
      },
    })
  },
  getFolderSuggestions() {
    return Api().get('/api/folder-suggestions')
  },
  dismissFolderSuggestion(folderName) {
    return Api().post(`/api/folder-suggestions/${encodeURIComponent(folderName)}/dismiss`)
  },
  getFolderRules() {
    return Api().get('/api/folder-rules')
  },
  createFolderRule(folderPath, gameId) {
    return Api().post('/api/folder-rules', {
      folder_path: folderPath,
      game_id: gameId,
    })
  },
  deleteFolderRule(ruleId, unlinkVideos = false) {
    return Api().delete(`/api/folder-rules/${ruleId}`, {
      params: {
        unlink_videos: unlinkVideos,
      },
    })
  },
}

export default service
