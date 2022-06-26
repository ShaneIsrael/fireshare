import React, { useCallback } from 'react'
import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VisibilityCard from './VisibilityCard'
import VideoModal from '../modal/VideoModal'
import SensorsIcon from '@mui/icons-material/Sensors'
import { VideoService } from '../../services'
import UploadCard from './UploadCard'

const VideoCards = ({ videos, loadingIcon = null, feedView = false, showUploadCard = false, authenticated, size }) => {
  const [vids, setVideos] = React.useState(videos)
  const [alert, setAlert] = React.useState({ open: false })
  const [videoModal, setVideoModal] = React.useState({
    open: false,
  })

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
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      {(!vids || vids.length === 0) && EMPTY_STATE()}
      {vids && vids.length !== 0 && (
        <Grid container justifyContent="center">
          {showUploadCard && (
            <UploadCard
              authenticated={authenticated}
              feedView={feedView}
              cardWidth={size}
              handleAlert={memoizedHandleAlert}
              publicUpload={feedView}
            />
          )}
          {vids.map((v) => (
            <VisibilityCard
              key={v.path + v.video_id}
              video={v}
              handleAlert={memoizedHandleAlert}
              openVideo={openVideo}
              cardWidth={size}
              authenticated={authenticated}
              deleted={handleDelete}
            />
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default VideoCards
