import Api from './Api'

// ─── Tag Service ──────────────────────────────────────────────────────────────
// Endpoints are stubs — backend needs to implement these routes.
//
//   GET  /api/videos/tag/:tag         → video[] (same shape as /api/videos)
//   GET  /api/video/:videoId/tags     → { tags: string[] }
//   PUT  /api/tag/:videoId            → body: { tags: string[] }

const service = {
  getTagVideos(tag) {
    return Api().get(`/api/videos/tag/${encodeURIComponent(tag)}`)
  },
  getVideoTags(videoId) {
    return Api().get(`/api/video/${videoId}/tags`)
  },
  setVideoTags(videoId, tags) {
    return Api().put(`/api/tag/${videoId}`, { tags })
  },
}

export default service
