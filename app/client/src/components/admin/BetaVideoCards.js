import React, { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoModal from '../modal/VideoModal'
import SensorsIcon from '@mui/icons-material/Sensors'
import { VideoService } from '../../services'
import UploadCard from './UploadCard'
import CompactBetaVideoCard from './CompactBetaVideoCard'

const BetaVideoCards = ({
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
  const containerRef = React.useRef()
  const previousVideosRef = React.useRef()
  const previousVideos = previousVideosRef.current
  if (videos !== previousVideos && videos !== vids) {
    setVideos(videos)
  }
  React.useEffect(() => {
    previousVideosRef.current = videos
  })

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
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      setIsSingleColumn(entry.contentRect.width < size * 2 + 24)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [size])

  const EMPTY_STATE = () => (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      <Grid
        sx={{ p: 2, height: 200 }}
        container
        item
        spacing={2}
        direction="column"
        justifyContent="center"
        alignItems="center"
      >
        {!loadingIcon && (
          <>
            <Grid item>
              <Typography
                variant="h4"
                align="center"
                color="primary"
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 500,
                  letterSpacing: '.2rem',
                  textDecoration: 'none',
                }}
              >
                NO VIDEOS FOUND
              </Typography>
            </Grid>

            {!feedView && (
              <Grid item>
                <Button variant="contained" size="large" startIcon={<SensorsIcon />} onClick={handleScan}>
                  Scan Library
                </Button>
              </Grid>
            )}
          </>
        )}
        {loadingIcon}
      </Grid>
      {!loadingIcon && (
        <Grid container justifyContent="center">
          <UploadCard
            authenticated={authenticated}
            feedView={feedView}
            cardWidth={250}
            handleAlert={memoizedHandleAlert}
            publicUpload={feedView}
          />
        </Grid>
      )}
    </Paper>
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
          {vids.map((v, index) => (
            <motion.div
              key={v.path + v.video_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <CompactBetaVideoCard
                video={v}
                openVideoHandler={openVideo}
                alertHandler={memoizedHandleAlert}
                authenticated={authenticated}
                editMode={editMode}
                selected={selectedVideos.has(v.video_id)}
                onSelect={onVideoSelect}
                onDelete={handleDelete}
                fullWidth={isSingleColumn}
              />
            </motion.div>
          ))}
        </Box>
      )}
    </Box>
  )
}

export default BetaVideoCards
