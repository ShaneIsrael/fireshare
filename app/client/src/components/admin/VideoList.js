import { Box, Grid, Modal, Paper, Typography } from '@mui/material'
import React from 'react'
import ReactPlayer from 'react-player'
import { getServedBy, getUrl } from '../../common/utils'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoListItem from './VideoListItem'

const URL = getUrl()
const SERVED_BY = getServedBy()

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
      id: video.video_id,
    })
  }

  const handleAlert = (alert) => {
    setAlert(alert)
  }

  return (
    <Box>
      <Modal open={videoModal.open} onClose={() => setVideoModal({ open: false })}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '95%',
            bgcolor: 'background.paper',
            // border: '2px solid #000',
            boxShadow: 24,
          }}
        >
          <ReactPlayer
            url={`${
              SERVED_BY === 'nginx'
                ? `${URL}/_content/video/${videoModal.id}.mp4`
                : `${URL}/api/video?id=${videoModal.id}`
            }`}
            width="100%"
            height="auto"
            controls
          />
        </Box>
      </Modal>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {!videos && EMPTY_STATE}
        {videos && (
          <Grid container>
            {videos.map((v) => (
              <Grid key={v.video_id} item xs={12}>
                <VideoListItem video={v} openVideoHandler={openVideo} alertHandler={handleAlert} />
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>
    </Box>
  )
}

export default VideoList
