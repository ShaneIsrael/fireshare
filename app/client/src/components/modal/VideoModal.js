import React from 'react'
import { Box, Button, ButtonGroup, Grid, Modal, TextField } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import ReactPlayer from 'react-player'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, useDebounce } from '../../common/utils'
import { VideoService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoModal = ({ open, onClose, video, feedView }) => {
  const [title, setTitle] = React.useState(null)
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const [vid, setVideo] = React.useState(video)
  const [alert, setAlert] = React.useState({ open: false })
  const playerRef = React.useRef(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)

  const getRandomVideo = async () => {
    try {
      const res = !feedView
        ? (await VideoService.getRandomVideo()).data
        : (await VideoService.getRandomPublicVideo()).data
      setVideo(res)
      setTitle(res.info?.title)
      setUpdatedTitle(null)
    } catch (err) {
      console.log(err)
    }
  }

  React.useEffect(() => {
    setVideo(video)
    setTitle(video?.info?.title)
  }, [video])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${vid.video_id}`, '_blank')
    }
  }

  const update = async () => {
    try {
      await VideoService.updateTitle(video.video_id, debouncedTitle)
      setAlert({
        type: 'success',
        message: 'Title Updated',
        open: true,
      })
    } catch (err) {
      setAlert({
        type: 'error',
        message: 'An error occurred trying to update the title',
        open: true,
      })
    }
  }

  React.useEffect(() => {
    if (debouncedTitle && debouncedTitle !== title) {
      update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle])

  if (!vid) return null

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Modal
        open={open}
        onClose={onClose}
        disableAutoFocus={true}
        BackdropProps={{
          sx: {
            background: 'rgba(0, 0, 0, 0.7)',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90%',
          }}
        >
          <Grid container justifyContent="center">
            <Grid item xs={12}>
              <ReactPlayer
                ref={playerRef}
                url={`${
                  SERVED_BY === 'nginx'
                    ? `${URL}/_content/video/${vid.video_id}${vid.extension}`
                    : `${URL}/api/video?id=${vid.video_id}`
                }`}
                width="100%"
                height="auto"
                volume={0.5}
                controls
              />
            </Grid>
            <Grid item>
              <ButtonGroup variant="contained">
                <Button onClick={getRandomVideo}>
                  <ShuffleIcon />
                </Button>
                <TextField
                  sx={{
                    textAlign: 'center',
                    '& .MuiOutlinedInput-root': { borderRadius: 0 },
                    background: 'rgba(50, 50, 50, 0.9)',
                  }}
                  size="small"
                  value={updatedTitle || title}
                  onChange={(e) => setUpdatedTitle(e.target.value)}
                />
                <CopyToClipboard text={`${PURL}${vid.video_id}`}>
                  <Button
                    onMouseDown={handleMouseDown}
                    onClick={() =>
                      setAlert({
                        type: 'info',
                        message: 'Link copied to clipboard',
                        open: true,
                      })
                    }
                  >
                    <LinkIcon />
                  </Button>
                </CopyToClipboard>
                <CopyToClipboard text={`${PURL}${vid.video_id}?t=${playerRef.current?.getCurrentTime()}`}>
                  <Button
                    onClick={() =>
                      setAlert({
                        type: 'info',
                        message: 'Time stamped link copied to clipboard',
                        open: true,
                      })
                    }
                  >
                    <AccessTimeIcon />
                  </Button>
                </CopyToClipboard>
              </ButtonGroup>
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </>
  )
}

export default VideoModal
