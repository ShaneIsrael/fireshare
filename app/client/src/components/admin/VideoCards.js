import React, { useCallback } from 'react'
import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VisibilityCard from './VisibilityCard'
import VideoModal from '../modal/VideoModal'
import SensorsIcon from '@mui/icons-material/Sensors'
import { VideoService } from '../../services'

const VideoCards = ({ videos, loadingIcon = null, feedView = false, authenticated, size }) => {
  const [vids, setVideos] = React.useState(videos)
  const [alert, setAlert] = React.useState({ open: false })
  const [videoModal, setVideoModal] = React.useState({
    open: false,
  })
  const [selectedTimeout, setSelectedTimeout] = React.useState(null)
  const [selected, setSelected] = React.useState(null)

  const previousVideosRef = React.useRef()
  const previousVideos = previousVideosRef.current
  if (videos !== previousVideos && videos !== vids) {
    setVideos(videos)
  }
  React.useEffect(() => {
    previousVideosRef.current = videos
  })

  const openVideo = (id) => {
    clearTimeout(selectedTimeout)
    setVideoModal({
      open: true,
      id,
    })
  }

  const onModalClose = () => {
    setSelectedTimeout(
      setTimeout(() => {
        setSelected(null)
      }, 5000),
    )
    setVideoModal({ open: false })
  }

  const memoizedHandleAlert = useCallback((alert) => {
    setAlert(alert)
  }, [])

  const handleSelected = (id) => {
    setSelected(id)
  }

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

  const EMPTY_STATE = () => (
    <Paper variant="outlined" sx={{ mr: 3, ml: 3, overflow: 'hidden' }}>
      <Grid
        sx={{ height: 200 }}
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
                {!feedView ? 'NO VIDEOS FOUND' : 'THERE ARE NO PUBLIC VIDEOS'}
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
    </Paper>
  )

  return (
    <>
      <VideoModal
        open={videoModal.open}
        onClose={onModalClose}
        videoId={videoModal.id}
        feedView={feedView}
        authenticated={authenticated}
        updateCallback={handleUpdate}
      />
      <Box>
        <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
          {alert.message}
        </SnackbarAlert>

        {(!vids || vids.length === 0) && EMPTY_STATE()}
        {vids && vids.length !== 0 && (
          <Grid container justifyContent="center">
            {vids.map((v) => (
              <VisibilityCard
                key={v.video_id}
                video={v}
                handleAlert={memoizedHandleAlert}
                handleSelected={handleSelected}
                openVideo={openVideo}
                selected={selected}
                cardWidth={size}
                feedView={feedView}
                authenticated={authenticated}
              />
            ))}
          </Grid>
        )}
      </Box>
    </>
  )
}

export default VideoCards
