import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

// Import and register the quality selector plugin
import qualitySelectorPlugin from '@silvermine/videojs-quality-selector'
import '@silvermine/videojs-quality-selector/dist/css/quality-selector.css'

// Register the quality selector plugin with videojs
qualitySelectorPlugin(videojs)

// Tolerance threshold for checking if player is already at the desired start time (in seconds)
const SEEK_TOLERANCE_SECONDS = 0.5

// How long to wait while buffering before switching to a lower quality source (in ms)
const BUFFER_STALL_TIMEOUT_MS = 5000

const VideoJSPlayer = ({
  sources,
  poster,
  autoplay = false,
  controls = true,
  fluid = true,
  fill = false,
  onTimeUpdate,
  onReady,
  startTime,
  className,
  style,
}) => {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const onTimeUpdateRef = useRef(onTimeUpdate)
  const onReadyRef = useRef(onReady)

  // Keep refs updated with latest callback values
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate
    onReadyRef.current = onReady
  }, [onTimeUpdate, onReady])

  useEffect(() => {
    // Make sure Video.js player is only initialized once
    if (!playerRef.current) {
      const videoElement = videoRef.current

      if (!videoElement) return

      const player = (playerRef.current = videojs(videoElement, {
        autoplay,
        controls,
        responsive: true,
        fluid,
        fill,
        poster,
        preload: 'auto',
        html5: {
          vhs: {
            overrideNative: true,
          },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
          nativeTextTracks: false,
        },
        controlBar: {
          children: [
            'playToggle',
            'volumePanel',
            'currentTimeDisplay',
            'timeDivider',
            'durationDisplay',
            'progressControl',
            'liveDisplay',
            'seekToLive',
            'remainingTimeDisplay',
            'customControlSpacer',
            'playbackRateMenuButton',
            'chaptersButton',
            'descriptionsButton',
            'subsCapsButton',
            'audioTrackButton',
            'qualitySelector',
            'fullscreenToggle',
          ],
        },
      }))

      // Set up sources
      if (sources && sources.length > 0) {
        player.src(sources)
      }

      // Switch to a lower quality source if stuck buffering
      let bufferStallTimer = null
      let currentSourceIndex = 0

      const switchToNextSource = () => {
        if (sources && currentSourceIndex + 1 < sources.length) {
          const currentTime = player.currentTime() || 0
          currentSourceIndex += 1
          const updatedSources = sources.map((s, i) => ({
            ...s,
            selected: i === currentSourceIndex,
          }))
          player.src(updatedSources)
          player.one('loadedmetadata', () => {
            if (currentTime > 0) {
              player.currentTime(currentTime)
            }
            const playPromise = player.play()
            if (playPromise !== undefined) {
              playPromise.catch(() => {})
            }
          })
        }
      }

      const clearStallTimer = () => {
        if (bufferStallTimer) {
          clearTimeout(bufferStallTimer)
          bufferStallTimer = null
        }
      }

      // On error, try the next source in the list
      player.on('error', switchToNextSource)

      // Sync currentSourceIndex when the source changes (e.g. user picks a quality)
      player.on('loadstart', () => {
        const current = player.currentSource()
        if (current && current.label) {
          const index = sources.findIndex((s) => s.label === current.label)
          if (index !== -1) {
            currentSourceIndex = index
          }
        }
      })

      // Auto-downgrade quality when buffering stalls
      player.on('waiting', () => {
        clearStallTimer()
        bufferStallTimer = setTimeout(() => {
          if (player.paused() || player.readyState() < 3) {
            switchToNextSource()
          }
        }, BUFFER_STALL_TIMEOUT_MS)
      })

      player.on('playing', clearStallTimer)
      player.on('pause', clearStallTimer)
      player.on('seeked', clearStallTimer)

      // Handle time updates using ref to avoid recreating player
      player.on('timeupdate', () => {
        const currentTime = player.currentTime()
        if (onTimeUpdateRef.current) {
          onTimeUpdateRef.current({ playedSeconds: currentTime || 0 })
        }
      })

      // Seek to start time if provided
      if (startTime) {
        // Try to seek immediately when metadata is loaded
        player.one('loadedmetadata', () => {
          player.currentTime(startTime)
        })

        // Also seek when user manually plays if not already at the correct time
        // This handles cases where autoplay is blocked
        player.one('play', () => {
          if (Math.abs(player.currentTime() - startTime) > SEEK_TOLERANCE_SECONDS) {
            player.currentTime(startTime)
          }
        })
      }

      // Call onReady when player is ready using ref
      player.ready(() => {
        if (onReadyRef.current) {
          onReadyRef.current(player)
        }
      })
    } else {
      const player = playerRef.current

      // Update sources if they change
      if (sources && sources.length > 0) {
        const currentSrc = player.currentSrc()
        // Check if the current source is in the new sources array
        const sourceExists = sources.some((source) => source.src === currentSrc)
        if (!sourceExists) {
          const currentTime = player.currentTime()
          player.src(sources)
          player.one('loadedmetadata', () => {
            player.currentTime(currentTime)
          })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, poster, autoplay, controls, startTime])

  // Dispose the Video.js player when the functional component unmounts
  useEffect(() => {
    const player = playerRef.current

    return () => {
      if (player && !player.isDisposed()) {
        player.dispose()
        playerRef.current = null
      }
    }
  }, [])

  return (
    <div data-vjs-player className={className} style={{ maxWidth: '100%', ...style }}>
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  )
}

export default VideoJSPlayer
