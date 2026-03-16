import Api from './Api'

// ─── Tag Service ──────────────────────────────────────────────────────────────
// Endpoints are stubs — we need to add these routes in the backend 
//
//   GET  /api/video/:videoId/tags          → { tags: string[] }
//   PUT  /api/video/:videoId/tags          → body: { tags: string[] }
//   GET  /api/tags/:tag/videos             → video[] (same shape as /api/videos)

const service = {
  getVideoTags(videoId) {
    return Api().get(`/api/video/${videoId}/tags`)
  },
  setVideoTags(videoId, tags) {
    return Api().put(`/api/video/${videoId}/tags`, { tags })
  },
  getTagVideos(tag) {
    return Api().get(`/api/tags/${encodeURIComponent(tag)}/videos`)
  },
}

export default service
