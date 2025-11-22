import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

// Import and register the quality selector plugin
import qualitySelectorPlugin from '@silvermine/videojs-quality-selector'
import '@silvermine/videojs-quality-selector/dist/css/quality-selector.css'

// Register the quality selector plugin with videojs
qualitySelectorPlugin(videojs)

const VideoJSPlayer = ({ 
  sources, 
  poster, 
  autoplay = false, 
  controls = true, 
  onTimeUpdate, 
  onReady,
  startTime,
  className,
  style 
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
        fluid: true,
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
          if (Math.abs(player.currentTime() - startTime) > 0.5) {
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
        const newSrc = sources[0].src
        if (currentSrc !== newSrc) {
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
    <div data-vjs-player className={className} style={style}>
      <video ref={videoRef} className="video-js vjs-big-play-centered" />
    </div>
  )
}

export default VideoJSPlayer
