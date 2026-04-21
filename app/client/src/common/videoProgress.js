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
    if (!position || position <= 0) return 0
    const effectiveDuration = duration || savedDuration
    // Only apply the boundary check when we have a reliable duration.
    // If duration is unknown, return the position anyway — the player will
    // validate against media.duration when it applies the seek.
    if (effectiveDuration > 0) {
      const pct = position / effectiveDuration
      if (position < 10 || pct > 0.9) return 0
    }
    return position
  } catch {
    return 0
  }
}
