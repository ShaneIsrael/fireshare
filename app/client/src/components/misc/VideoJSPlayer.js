import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'

// Import and register the quality selector plugin
import '@silvermine/videojs-quality-selector'
import '@silvermine/videojs-quality-selector/dist/css/quality-selector.css'

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
        player.one('loadedmetadata', () => {
          player.currentTime(startTime)
        })
      }

      // Call onReady when player is ready using ref
      player.ready(() => {
        if (onReadyRef.current) {
          onReadyRef.current(player)
        }
        
        // Enable quality selector if multiple sources
        // Only add if not already present to avoid duplicates
        if (sources && sources.length > 1 && !player.controlBar.getChild('QualitySelector')) {
          player.controlBar.addChild('QualitySelector')
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
