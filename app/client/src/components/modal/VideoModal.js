import React from 'react'
import { Box, Button, ButtonGroup, Grid, IconButton, InputAdornment, Modal, Paper, TextField } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import SaveIcon from '@mui/icons-material/Save'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { copyToClipboard, getPublicWatchUrl, getServedBy, getUrl, getVideoPath } from '../../common/utils'
import { VideoService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoModal = ({ open, onClose, videoId, feedView, authenticated, updateCallback }) => {
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [updateable, setUpdatable] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(false)
  const [vid, setVideo] = React.useState(null)
  const [views, setViews] = React.useState()
  const [viewAdded, setViewAdded] = React.useState(false)
  const [videoDuration, setVideoDuration] = React.useState()
  const [alert, setAlert] = React.useState({ open: false })

  const playerRef = React.useRef()

  const getRandomVideo = async () => {
    try {
      const res = !feedView
        ? (await VideoService.getRandomVideo()).data
        : (await VideoService.getRandomPublicVideo()).data

      const videoViews = (await VideoService.getViews(res.video_id)).data
      setViews(videoViews)
      setViewAdded(false)
      setVideo(res)
      setTitle(res.info?.title)
      setDescription(res.info?.description)
      setUpdatable(false)
      setPrivateView(res.info?.private)
    } catch (err) {
      console.log(err)
    }
  }

  React.useEffect(() => {
    async function fetch() {
      try {
        const details = (await VideoService.getDetails(videoId)).data
        const videoViews = (await VideoService.getViews(videoId)).data
        setViews(videoViews)
        setViewAdded(false)
        setVideo(details)
        setTitle(details.info?.title)
        setDescription(details.info?.description)
        setPrivateView(details.info?.private)
        setUpdatable(false)
      } catch (err) {
        setAlert(
          setAlert({
            type: 'error',
            message: 'Unable to load video details',
            open: true,
          }),
        )
      }
    }
    if (videoId) {
      fetch()
    }
  }, [videoId])

  React.useEffect(() => {
    if (playerRef.current) {
      setVideoDuration(playerRef.current.duration)
    }
  }, [playerRef.current])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${vid.video_id}`, '_blank')
    }
  }

  const update = async () => {
    if (updateable && authenticated) {
      try {
        await VideoService.updateDetails(vid.video_id, { title, description })
        setUpdatable(false)
        updateCallback({ id: vid.video_id, title, description })
        setAlert({
          type: 'success',
          message: 'Details Updated',
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
        updateCallback({ id: vid.video_id, private: !privateView })
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
      setUpdatable(newValue !== vid.info?.title || description !== vid.info?.description)
    }
    setTitle(newValue)
  }

  const handleDescriptionChange = (newValue) => {
    if (newValue) {
      setUpdatable(newValue !== vid.info?.description || title !== vid.info?.title)
    }
    setDescription(newValue)
  }

  const copyTimestamp = () => {
    copyToClipboard(`${PURL}${vid.video_id}?t=${playerRef.current?.currentTime}`)
    setAlert({
      type: 'info',
      message: 'Time stamped link copied to clipboard',
      open: true,
    })
  }

  const handleTimeUpdate = (e) => {
    if (!viewAdded) {
      if (videoDuration < 10) {
        setViewAdded(true)
        VideoService.addView(vid?.video_id || videoId).catch((err) => console.error(err))
      } else if (e.target.currentTime >= 10) {
        setViewAdded(true)
        VideoService.addView(vid?.video_id || videoId).catch((err) => console.error(err))
      }
    }
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
              <video
                ref={playerRef}
                width="100%"
                height="auto"
                autoPlay
                src={`${
                  SERVED_BY === 'nginx'
                    ? `${URL}/_content/video/${getVideoPath(vid.video_id, vid.extension)}`
                    : `${URL}/api/video?id=${vid.extension === '.mkv' ? `${vid.video_id}&subid=1` : vid.video_id}`
                }`}
                disablePictureInPicture
                controls
                onTimeUpdate={handleTimeUpdate}
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
                    background: 'rgba(50, 50, 50, 0.9)',
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      width: {
                        xs: 'auto',
                        sm: 350,
                        md: 450,
                      },
                    },
                    '& .MuiInputBase-input.Mui-disabled': {
                      WebkitTextFillColor: '#fff',
                    },
                  }}
                  size="small"
                  value={title}
                  placeholder="Video Title"
                  disabled={!authenticated}
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
                <Button onClick={copyTimestamp}>
                  <AccessTimeIcon />
                </Button>
              </ButtonGroup>
              {(authenticated || description) && (
                <Paper sx={{ width: '100%', mt: 1, p: 1, background: 'rgba(50, 50, 50, 0.9)' }}>
                  <TextField
                    fullWidth
                    disabled={!authenticated}
                    sx={{
                      '& .MuiInputBase-input.Mui-disabled': {
                        WebkitTextFillColor: '#fff',
                      },
                      '& .MuiOutlinedInput-notchedOutline': {
                        border: 'none',
                      },
                    }}
                    size="small"
                    placeholder="Enter a video description..."
                    value={description || ''}
                    onChange={(e) => handleDescriptionChange(e.target.value)}
                    multiline
                  />
                </Paper>
              )}
            </Grid>
          </Grid>
        </Box>
      </Modal>
    </>
  )
}

export default VideoModal
