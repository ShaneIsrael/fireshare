import React from 'react'
import { Box, Button, ButtonGroup, Grid, IconButton, InputAdornment, Modal, TextField } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import ReactPlayer from 'react-player'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl } from '../../common/utils'
import { VideoService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoModal = ({ open, onClose, video, feedView, authenticated }) => {
  const [title, setTitle] = React.useState('')
  const [updateable, setUpdatable] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(video?.info?.private)
  const [vid, setVideo] = React.useState(video)

  const [alert, setAlert] = React.useState({ open: false })

  const playerRef = React.useRef(null)

  const getRandomVideo = async () => {
    try {
      const res = !feedView
        ? (await VideoService.getRandomVideo()).data
        : (await VideoService.getRandomPublicVideo()).data
      setVideo(res)
      setTitle(res.info?.title)
      setUpdatable(false)
      setPrivateView(res.info?.private)
    } catch (err) {
      console.log(err)
    }
  }

  React.useEffect(() => {
    setVideo(video)
    setTitle(video?.info?.title)
    setPrivateView(video?.info?.private)
    setUpdatable(false)
  }, [video])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${vid.video_id}`, '_blank')
    }
  }

  const update = async () => {
    if (updateable && authenticated) {
      try {
        await VideoService.updateTitle(vid.video_id, title)
        setUpdatable(false)
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
  }

  const handlePrivacyChange = async () => {
    if (authenticated) {
      try {
        await VideoService.updatePrivacy(vid.video_id, !privateView)
        setAlert({
          type: privateView ? 'info' : 'warning',
          message: privateView ? `Added to your public feed` : `Removed from your public feed`,
          open: true,
        })
        setPrivateView(!privateView)
      } catch (err) {
        console.log(err)
      }
    }
  }

  const handleTitleChange = (newValue) => {
    if (newValue) {
      setUpdatable(newValue !== vid.info?.title)
    }
    setTitle(newValue)
  }

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
                {authenticated && (
                  <Button onClick={handlePrivacyChange} edge="end">
                    {privateView ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </Button>
                )}
                <TextField
                  sx={{
                    textAlign: 'center',
                    '& .MuiOutlinedInput-root': { borderRadius: 0 },
                    background: 'rgba(50, 50, 50, 0.9)',
                  }}
                  size="small"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && update()}
                  InputProps={{
                    endAdornment: authenticated && (
                      <InputAdornment position="end">
                        <IconButton
                          disabled={!updateable}
                          sx={
                            updateable
                              ? {
                                  animation: 'blink-blue 0.5s ease-in-out infinite alternate',
                                }
                              : {}
                          }
                          onClick={update}
                          edge="end"
                        >
                          <SaveIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
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
