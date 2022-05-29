import React, { useCallback } from 'react'
import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import VisibilityCard from './VisibilityCard'
import VideoModal from '../modal/VideoModal'
import SensorsIcon from '@mui/icons-material/Sensors'
import { VideoService } from '../../services'

const EMPTY_STATE = (loadingIcon, handleScan) => (
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
              NO VIDEOS FOUND
            </Typography>
          </Grid>
          <Grid item>
            <Button variant="contained" size="large" startIcon={<SensorsIcon />} onClick={handleScan}>
              Scan Library
            </Button>
          </Grid>
        </>
      )}
      {loadingIcon}
    </Grid>
  </Paper>
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

  return (
    <>
      <VideoModal open={videoModal.open} onClose={onModalClose} video={videoModal.video} />
      <Box>
        <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
          {alert.message}
        </SnackbarAlert>

        {!videos && EMPTY_STATE(loadingIcon, handleScan)}
        {videos && (
          <Grid container spacing={1} justifyContent="center" alignItems="flex-start">
            {videos.map((v) => (
              <VisibilityCard
                key={v.video_id}
                video={v}
                handleAlert={memoizedHandleAlert}
                handleSelected={handleSelected}
                openVideo={openVideo}
                selected={selected}
                cardWidth={375}
              />
            ))}
          </Grid>
        )}
      </Box>
    </>
  )
}

export default VideoCards
