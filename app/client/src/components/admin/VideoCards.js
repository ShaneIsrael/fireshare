import React from 'react'
import { Box, Grid, Modal, Typography } from '@mui/material'
import ReactPlayer from 'react-player'
import { getServedBy, getUrl } from '../../common/utils'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoCardItem from './VideoCardItem'

const URL = getUrl()
const SERVED_BY = getServedBy()

const EMPTY_STATE = (
  <Grid sx={{ height: '100%' }} container direction="row" justifyContent="center">
    <Grid container item justifyContent="center" sx={{ mt: 10 }}>
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
    </Grid>
  </Grid>
)

const VideoCards = ({ videos }) => {
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
                ? `${URL}/_content/video_links/${videoModal.id}.mp4`
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
      {!videos && EMPTY_STATE}
      {videos && (
        <Grid container spacing={2} justifyContent="center">
          {videos.map((v) => (
            <Grid key={v.video_id} item>
              <VideoCardItem video={v} openVideoHandler={openVideo} alertHandler={handleAlert} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default VideoCards
