const KEY_PREFIX = 'fireshare_progress_'

export function saveProgress(videoId, position, duration) {
  try {
    localStorage.setItem(KEY_PREFIX + videoId, JSON.stringify({ position, duration, updatedAt: Date.now() }))
  } catch {}
}

export function getResumeTime(videoId, duration) {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + videoId)
    if (!raw) return 0
    const { position, duration: savedDuration } = JSON.parse(raw)
    const effectiveDuration = duration || savedDuration
    if (!effectiveDuration || !position) return 0
    const pct = position / effectiveDuration
    if (pct < 0.1 || pct > 0.9) return 0
    return position
  } catch {
    return 0
  }
}
