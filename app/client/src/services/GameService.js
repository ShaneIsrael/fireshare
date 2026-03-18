import Api from './Api'

// Module-level map: steamgriddb_id -> bust timestamp, persists across navigation
const _assetBusts = {}

export const recordAssetBust = (steamgriddbId) => {
  _assetBusts[steamgriddbId] = Date.now()
}

export const applyAssetBusts = (games) => {
  return games.map((g) => {
    const bust = _assetBusts[g.steamgriddb_id]
    if (!bust) return g
    const base = `/api/game/assets/${g.steamgriddb_id}`
    return {
      ...g,
      hero_url: `${base}/hero_1.png?v=${bust}`,
      banner_url: `${base}/hero_2.png?v=${bust}`,
      logo_url: `${base}/logo_1.png?v=${bust}`,
      icon_url: `${base}/icon_1.png?v=${bust}`,
    }
  })
}

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
  getGameAssetOptions(gameId) {
    return Api().get(`/api/steamgrid/game/${gameId}/assets/options`)
  },
  updateGameAsset(gameId, assetType, url) {
    return Api().put(`/api/games/${gameId}/assets`, { asset_type: assetType, url })
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
