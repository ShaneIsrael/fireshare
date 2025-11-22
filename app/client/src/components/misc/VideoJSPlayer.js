import React, { useEffect, useRef } from 'react'
import videojs from 'video.js'
import 'video.js/dist/video-js.css'
import 'videojs-contrib-quality-levels'
import 'videojs-http-source-selector'

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

      // Handle time updates
      if (onTimeUpdate) {
        player.on('timeupdate', () => {
          const currentTime = player.currentTime()
          onTimeUpdate({ playedSeconds: currentTime || 0 })
        })
      }

      // Seek to start time if provided
      if (startTime) {
        player.one('loadedmetadata', () => {
          player.currentTime(startTime)
        })
      }

      // Call onReady when player is ready
      if (onReady) {
        player.ready(() => {
          onReady(player)
        })
      }

      // Enable source selector if multiple sources
      if (sources && sources.length > 1) {
        player.httpSourceSelector()
      }
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
  }, [sources, poster, autoplay, controls, onTimeUpdate, onReady, startTime])

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
