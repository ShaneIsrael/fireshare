import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import React, { useCallback } from 'react'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoModal from '../modal/VideoModal'
import VideoListItem from './VideoListItem'
import SensorsIcon from '@mui/icons-material/Sensors'
import { VideoService } from '../../services'

const VideoList = ({ videos, loadingIcon = null, feedView = false, authenticated }) => {
  const [alert, setAlert] = React.useState({ open: false })
  const [videoModal, setVideoModal] = React.useState({
    open: false,
  })

  const openVideo = (video) => {
    setVideoModal({
      open: true,
      video,
    })
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

  const EMPTY_STATE = () => (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
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
    <Box sx={{ pl: 3, pr: 3 }}>
      <VideoModal
        open={videoModal.open}
        onClose={() => setVideoModal({ open: false })}
        video={videoModal.video}
        feedView={feedView}
      />
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      {(!videos || videos.length === 0) && EMPTY_STATE()}
      {videos && videos.length !== 0 && (
        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <Grid container>
            {videos.map((v) => (
              <Grid key={v.video_id} item xs={12}>
                <VideoListItem
                  video={v}
                  openVideoHandler={openVideo}
                  alertHandler={memoizedHandleAlert}
                  feedView={feedView}
                  authenticated={authenticated}
                />
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  )
}

export default VideoList
