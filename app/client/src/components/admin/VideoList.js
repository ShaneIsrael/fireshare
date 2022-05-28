import { Box, Grid, Paper, Typography } from '@mui/material'
import React, { useCallback } from 'react'
import { getServedBy, getUrl } from '../../common/utils'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoModal from '../modal/VideoModal'
import VideoListItem from './VideoListItem'

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

const VideoList = ({ videos, loadingIcon = null }) => {
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

  return (
    <Box sx={{ pl: 3, pr: 3 }}>
      <VideoModal open={videoModal.open} onClose={() => setVideoModal({ open: false })} video={videoModal.video} />
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {!videos && EMPTY_STATE(loadingIcon)}
        {videos && (
          <Grid container>
            {videos.map((v) => (
              <Grid key={v.video_id} item xs={12}>
                <VideoListItem video={v} openVideoHandler={openVideo} alertHandler={memoizedHandleAlert} />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  )
}

export default VideoList
