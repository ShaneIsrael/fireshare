import React, { useCallback } from 'react'
import { Box, Grid, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VisibilityCard from './VisibilityCard'
import VideoModal from '../modal/VideoModal'

const EMPTY_STATE = (loadingIcon) => (
  <Grid sx={{ height: '100%' }} container direction="row" justifyContent="center">
    <Grid container item justifyContent="center" sx={{ mt: 10 }}>
      {!loadingIcon && (
        <Typography
          variant="h4"
          sx={{
            fontFamily: 'monospace',
            fontWeight: 500,
            letterSpacing: '.2rem',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          NO VIDEOS
        </Typography>
      )}
      {loadingIcon}
    </Grid>
  </Grid>
)

const VideoCards = ({ videos, loadingIcon = null }) => {
  const [alert, setAlert] = React.useState({ open: false })
  const [videoModal, setVideoModal] = React.useState({
    open: false,
  })
  const [selectedTimeout, setSelectedTimeout] = React.useState(null)
  const [selected, setSelected] = React.useState(null)

  const openVideo = (video) => {
    clearTimeout(selectedTimeout)
    setVideoModal({
      open: true,
      video,
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

  // const handleAlert = (alert) => {
  //   setAlert(alert)
  // }
  const memoizedHandleAlert = useCallback((alert) => {
    setAlert(alert)
  }, [])

  const handleSelected = (id) => {
    setSelected(id)
  }

  return (
    <Box>
      <VideoModal open={videoModal.open} onClose={onModalClose} video={videoModal.video} />
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      {!videos && EMPTY_STATE(loadingIcon)}
      {videos && (
        <Grid container spacing={2} justifyContent="center">
          {videos.map((v) => (
            <VisibilityCard
              key={v.video_id}
              video={v}
              handleAlert={memoizedHandleAlert}
              handleSelected={handleSelected}
              openVideo={openVideo}
              selected={selected}
            />
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default VideoCards
