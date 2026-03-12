import React, { useEffect, useRef, useState, useMemo } from 'react'
import '@videojs/react/video/skin.css'
import { createPlayer, useMedia, Popover, Poster } from '@videojs/react'
import { Video, VideoSkin, videoFeatures } from '@videojs/react/video'

// Tolerance threshold for checking if player is already at the desired start time (in seconds)
const SEEK_TOLERANCE_SECONDS = 0.5

// How long to wait while buffering before switching to a lower quality source (in ms)
const BUFFER_STALL_TIMEOUT_MS = 5000

// Number of buffering events within the window that triggers a quality downgrade
const BUFFER_COUNT_THRESHOLD = 4

// Sliding window duration for counting buffering events (in ms)
const BUFFER_COUNT_WINDOW_MS = 30000

// Create the Video.js 10 player instance (module-level singleton)
const Player = createPlayer({ features: videoFeatures })

/**
 * Inner component that handles player effects (time updates, seeking, onReady,
 * and automatic quality downgrade). Must be rendered inside <Player.Provider>.
 */
function PlayerEffects({ sources, onSourceChange, onTimeUpdate, onReady, startTime }) {
  const store = Player.usePlayer()
  const media = Player.useMedia()
  const currentTime = Player.usePlayer((s) => s.currentTime)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onReadyRef = useRef(onReady)
  const startTimeApplied = useRef(false)
  const readyFired = useRef(false)

  // Keep refs updated with latest callback values
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
    onReadyRef.current = onReady
  }, [onTimeUpdate, onReady])

  // --- onTimeUpdate: report current time to parent ---------------------------
  useEffect(() => {
    if (onTimeUpdateRef.current) {
      onTimeUpdateRef.current({ playedSeconds: currentTime || 0 })
    }
  }, [currentTime])

  // --- onReady: provide a wrapper that mimics the v8 player API --------------
  const mediaRef = useRef(null)
  useEffect(() => {
    mediaRef.current = media
  }, [media])

  const playerWrapper = useMemo(
    () => ({
      currentTime: () => mediaRef.current?.currentTime ?? 0,
      duration: () => mediaRef.current?.duration ?? 0,
      paused: () => mediaRef.current?.paused ?? true,
      play: () => store.play?.(),
      pause: () => store.pause?.(),
    }),
    [store],
  )

  useEffect(() => {
    if (media && !readyFired.current) {
      readyFired.current = true
      if (onReadyRef.current) {
        onReadyRef.current(playerWrapper)
      }
    }
  }, [media, playerWrapper])

  // --- startTime: seek to the requested position once metadata is loaded -----
  useEffect(() => {
    if (!media || !startTime || startTimeApplied.current) return

    const handleLoaded = () => {
      if (media.readyState >= 1) {
        media.currentTime = startTime
        startTimeApplied.current = true
      }
    }

    // If metadata already loaded, seek immediately
    if (media.readyState >= 1) {
      media.currentTime = startTime
      startTimeApplied.current = true
    } else {
      media.addEventListener('loadedmetadata', handleLoaded, { once: true })
    }

    // Also handle the case where autoplay is blocked and user manually presses play
    const handlePlay = () => {
      if (!startTimeApplied.current || Math.abs(media.currentTime - startTime) > SEEK_TOLERANCE_SECONDS) {
        media.currentTime = startTime
        startTimeApplied.current = true
      }
    }
    media.addEventListener('play', handlePlay, { once: true })

    return () => {
      media.removeEventListener('loadedmetadata', handleLoaded)
      media.removeEventListener('play', handlePlay)
    }
  }, [media, startTime])

  // --- Auto-downgrade: switch to lower quality on buffering / error ----------
  useEffect(() => {
    if (!media || !sources || sources.length <= 1) return

    let bufferStallTimer = null
    let bufferTimestamps = []
    let isSourceTransitioning = false
    let sourceTransitionTimer = null

    const clearStallTimer = () => {
      if (bufferStallTimer) {
        clearTimeout(bufferStallTimer)
        bufferStallTimer = null
      }
    }

    const clearTransitionTimer = () => {
      if (sourceTransitionTimer) {
        clearTimeout(sourceTransitionTimer)
        sourceTransitionTimer = null
      }
    }

    const switchToNextSource = () => {
      onSourceChange((prev) => {
        if (prev + 1 < sources.length) return prev + 1
        return prev
      })
    }

    const handleError = () => {
      if (isSourceTransitioning) {
        setTimeout(() => {
          if (media.error) {
            isSourceTransitioning = false
            clearTransitionTimer()
            switchToNextSource()
          }
        }, 1000)
      } else {
        switchToNextSource()
      }
    }

    const handleLoadStart = () => {
      isSourceTransitioning = true
      bufferTimestamps = []
      clearStallTimer()
      clearTransitionTimer()
      sourceTransitionTimer = setTimeout(() => {
        isSourceTransitioning = false
      }, BUFFER_STALL_TIMEOUT_MS)
    }

    const handleCanPlay = () => {
      isSourceTransitioning = false
      clearTransitionTimer()
    }

    const handleWaiting = () => {
      if (isSourceTransitioning) return

      const now = Date.now()
      bufferTimestamps.push(now)
      bufferTimestamps = bufferTimestamps.filter((t) => now - t < BUFFER_COUNT_WINDOW_MS)

      if (bufferTimestamps.length >= BUFFER_COUNT_THRESHOLD) {
        bufferTimestamps = []
        clearStallTimer()
        switchToNextSource()
        return
      }

      clearStallTimer()
      bufferStallTimer = setTimeout(() => {
        if (media.paused || media.readyState < 3) {
          bufferTimestamps = []
          switchToNextSource()
        }
      }, BUFFER_STALL_TIMEOUT_MS)
    }

    const handlePlayingOrPause = () => clearStallTimer()

    media.addEventListener('error', handleError)
    media.addEventListener('loadstart', handleLoadStart)
    media.addEventListener('canplay', handleCanPlay)
    media.addEventListener('waiting', handleWaiting)
    media.addEventListener('playing', handlePlayingOrPause)
    media.addEventListener('pause', handlePlayingOrPause)
    media.addEventListener('seeked', handlePlayingOrPause)

    return () => {
      clearStallTimer()
      clearTransitionTimer()
      media.removeEventListener('error', handleError)
      media.removeEventListener('loadstart', handleLoadStart)
      media.removeEventListener('canplay', handleCanPlay)
      media.removeEventListener('waiting', handleWaiting)
      media.removeEventListener('playing', handlePlayingOrPause)
      media.removeEventListener('pause', handlePlayingOrPause)
      media.removeEventListener('seeked', handlePlayingOrPause)
    }
  }, [media, sources, onSourceChange])

  return null
}

/**
 * Quality selector button rendered inside the VideoSkin controls.
 * Uses a Popover to show available quality options.
 */
function QualitySelector({ sources, currentSourceIndex, onSourceChange }) {
  const media = Player.useMedia()

  if (!sources || sources.length <= 1) return null

  const currentLabel = sources[currentSourceIndex]?.label || 'Quality'

  const handleSelect = (index) => {
    const savedTime = media?.currentTime ?? 0
    const wasPlaying = media && !media.paused

    onSourceChange(index)

    // After source changes, restore playback position
    if (media) {
      const restoreTime = () => {
        if (savedTime > 0) {
          media.currentTime = savedTime
        }
        if (wasPlaying) {
          const p = media.play()
          if (p) p.catch(() => {})
        }
      }
      media.addEventListener('canplay', restoreTime, { once: true })
    }
  }

  return (
    <Popover.Root openOnHover delay={200} closeDelay={300} side="top">
      <Popover.Trigger
        render={(props) => (
          <button
            {...props}
            type="button"
            className="media-button media-button--icon"
            style={{ fontSize: '0.75rem', fontWeight: 600, minWidth: 40 }}
          >
            {currentLabel}
          </button>
        )}
      />
      <Popover.Popup className="media-surface media-popover" style={{ padding: '4px 0' }}>
        {sources.map((source, index) => (
          <button
            key={source.label || index}
            type="button"
            onClick={() => handleSelect(index)}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 16px',
              border: 'none',
              background: index === currentSourceIndex ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: '0.8rem',
              fontWeight: index === currentSourceIndex ? 700 : 400,
            }}
          >
            {source.label || `Source ${index + 1}`}
          </button>
        ))}
      </Popover.Popup>
    </Popover.Root>
  )
}

/**
 * VideoJSPlayer — a drop-in replacement powered by Video.js 10.
 *
 * Accepts the same props as the previous v8 component so that consumers
 * (Watch.js, VideoModal.js) do not need to change their usage.
 */
const VideoJSPlayer = ({
  sources,
  poster,
  autoplay = false,
  fill = false,
  playsinline = false,
  onTimeUpdate,
  onReady,
  startTime,
  className,
  style,
}) => {
  const [currentSourceIndex, setCurrentSourceIndex] = useState(() => {
    // Start with the "selected" source, or default to index 0
    const idx = sources?.findIndex((s) => s.selected)
    return idx >= 0 ? idx : 0
  })

  // Reset source index when the sources array identity changes (e.g. new video)
  const prevSourcesRef = useRef(sources)
  useEffect(() => {
    if (sources !== prevSourcesRef.current) {
      prevSourcesRef.current = sources
      const idx = sources?.findIndex((s) => s.selected)
      setCurrentSourceIndex(idx >= 0 ? idx : 0)
    }
  }, [sources])

  const activeSrc = sources?.[currentSourceIndex]?.src || sources?.[0]?.src

  // Container styles: emulate fluid / fill behaviour
  const containerStyle = {
    maxWidth: '100%',
    ...(fill && { width: '100%', height: '100%' }),
    ...style,
  }

  return (
    <Player.Provider>
      <VideoSkin className={className} style={containerStyle}>
        <Video src={activeSrc} autoPlay={autoplay} playsInline={playsinline} preload="auto" />
        {poster && <Poster src={poster} alt="" />}
        <QualitySelector
          sources={sources}
          currentSourceIndex={currentSourceIndex}
          onSourceChange={setCurrentSourceIndex}
        />
      </VideoSkin>
      <PlayerEffects
        sources={sources}
        onSourceChange={setCurrentSourceIndex}
        onTimeUpdate={onTimeUpdate}
        onReady={onReady}
        startTime={startTime}
      />
    </Player.Provider>
  )
}

export default VideoJSPlayer
