import React, { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Box, Button, Grid, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoModal from '../modal/VideoModal'
import SensorsIcon from '@mui/icons-material/Sensors'
import OndemandVideoIcon from '@mui/icons-material/OndemandVideo'
import { VideoService } from '../../services'
import CompactVideoCard from './CompactVideoCard'

const PAGE_SIZE = 48

const VideoCards = ({
  videos,
  loadingIcon = null,
  feedView = false,
  authenticated,
  size,
  editMode = false,
  selectedVideos = new Set(),
  onVideoSelect,
}) => {
  const [vids, setVideos] = React.useState(videos)
  const [alert, setAlert] = React.useState({ open: false })
  const [videoModal, setVideoModal] = React.useState({
    open: false,
  })
  const [isSingleColumn, setIsSingleColumn] = React.useState(false)
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const containerRef = React.useRef()
  const sentinelRef = React.useRef()

  React.useEffect(() => {
    setVideos(videos || [])
    setVisibleCount(PAGE_SIZE)
  }, [videos])

  const openVideo = (id) => {
    setVideoModal({
      open: true,
      id,
    })
  }

  const onModalClose = () => {
    setVideoModal({ open: false })
  }

  const memoizedHandleAlert = useCallback((alert) => {
    setAlert(alert)
  }, [])

  const handleScan = () => {
    VideoService.scan().catch((err) =>
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Unknown Error',
      }),
    )
    setAlert({
      open: true,
      type: 'info',
      message: 'Scan initiated. This could take a few minutes.',
    })
  }

  const handleUpdate = (update) => {
    const { id, ...rest } = update
    setVideos((vs) => vs.map((v) => (v.video_id === id ? { ...v, info: { ...v.info, ...rest } } : v)))
  }

  const handleDelete = (id) => {
    setVideos((vs) => vs.filter((v) => v.video_id !== id))
  }

  React.useEffect(() => {
    if (!vids || vids.length === 0) {
      setIsSingleColumn(false)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width || 0
      if (!width) return
      const single = width < size * 2 + 24
      setIsSingleColumn(single)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [size, vids])

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, vids.length))
        }
      },
      { rootMargin: '400px' },
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [vids.length])

  const EMPTY_STATE = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 8,
        px: 3,
        border: '1px solid #FFFFFF14',
        borderRadius: '16px',
        background: '#00000040',
      }}
    >
      {!loadingIcon && (
        <>
          <OndemandVideoIcon sx={{ fontSize: 56, color: '#FFFFFF33' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: 'white', mb: 0.5 }}>
              No videos found
            </Typography>
            {!feedView && (
              <Typography sx={{ fontSize: 14, color: '#FFFFFF66' }}>
                Scan your library to discover videos
              </Typography>
            )}
          </Box>
          {!feedView && (
            <Button
              variant="contained"
              size="large"
              startIcon={<SensorsIcon />}
              onClick={handleScan}
              sx={{
                background: 'linear-gradient(90deg, #BC00E6, #FF3729)',
                '&:hover': { background: 'linear-gradient(90deg, #CC10F6, #FF4739)' },
                fontWeight: 600,
                px: 3,
                mt: 1,
              }}
            >
              Scan Library
            </Button>
          )}
        </>
      )}
      {loadingIcon}
    </Box>
  )

  return (
    <Box>
      <VideoModal
        open={videoModal.open}
        onClose={onModalClose}
        videoId={videoModal.id}
        feedView={feedView}
        authenticated={authenticated}
        updateCallback={handleUpdate}
        onNext={() => {
          const i = vids.findIndex((v) => v.video_id === videoModal.id)
          if (i < vids.length - 1) setVideoModal({ open: true, id: vids[i + 1].video_id })
        }}
        onPrev={() => {
          const i = vids.findIndex((v) => v.video_id === videoModal.id)
          if (i > 0) setVideoModal({ open: true, id: vids[i - 1].video_id })
        }}
      />
      <SnackbarAlert
        severity={alert.type}
        open={alert.open}
        onClose={alert.onClose}
        setOpen={(open) => setAlert({ ...alert, open })}
      >
        {alert.message}
      </SnackbarAlert>

      {(!vids || vids.length === 0) && EMPTY_STATE()}
      {vids && vids.length !== 0 && (
        <>
          <Box
            ref={containerRef}
            sx={{
              display: 'grid',
              width: isSingleColumn ? 'calc(100% + 48px)' : '100%',
              mx: isSingleColumn ? '-24px' : 0,
              gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${size}px), 1fr))`,
              gap: '24px',
            }}
          >
            {vids.slice(0, visibleCount).map((v, index) => (
              <motion.div
                key={v.path + v.video_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index % PAGE_SIZE, 12) * 0.04 }}
              >
                <CompactVideoCard
                  video={v}
                  openVideoHandler={openVideo}
                  alertHandler={memoizedHandleAlert}
                  authenticated={authenticated}
                  editMode={editMode}
                  selected={selectedVideos.has(v.video_id)}
                  onSelect={onVideoSelect}
                  onDelete={handleDelete}
                />
              </motion.div>
            ))}
          </Box>
          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </Box>
  )
}

export default VideoCards
