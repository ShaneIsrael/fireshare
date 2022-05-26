import React, { useRef } from 'react'
import { Box, Grid, Modal, Typography } from '@mui/material'
import ReactPlayer from 'react-player'
import { getServedBy, getUrl } from '../../common/utils'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoCardItem from './VideoCardItem'
import VisibilitySensor from 'react-visibility-sensor'
import VisibilityCard from './VisibilityCard'

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
      id: video.video_id,
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

  const handleAlert = (alert) => {
    setAlert(alert)
  }

  const handleSelected = (id) => {
    setSelected(id)
  }

  return (
    <Box>
      <Modal open={videoModal.open} onClose={onModalClose}>
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

      {!videos && EMPTY_STATE(loadingIcon)}
      {videos && (
        <Grid container spacing={2} justifyContent="center">
          {videos.map((v) => (
            <VisibilityCard
              key={v.video_id}
              video={v}
              handleAlert={handleAlert}
              handleSelected={handleSelected}
              openVideo={openVideo}
              selected
            />
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default VideoCards
