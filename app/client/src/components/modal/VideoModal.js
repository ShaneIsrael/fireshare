import React from 'react'
import ReactPlayer from 'react-player'
import { Button, ButtonGroup, Grid, IconButton, InputAdornment, Modal, Paper, Slide, TextField } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import ShuffleIcon from '@mui/icons-material/Shuffle'
import SaveIcon from '@mui/icons-material/Save'
import CloseIcon from '@mui/icons-material/Close'
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
  const [viewAdded, setViewAdded] = React.useState(false)
  const [alert, setAlert] = React.useState({ open: false })

  const playerRef = React.useRef()

  const getRandomVideo = async () => {
    try {
      const res = !feedView
        ? (await VideoService.getRandomVideo()).data
        : (await VideoService.getRandomPublicVideo()).data

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
    copyToClipboard(`${PURL}${vid.video_id}?t=${playerRef.current?.getCurrentTime()}`)
    setAlert({
      type: 'info',
      message: 'Time stamped link copied to clipboard',
      open: true,
    })
  }

  const handleTimeUpdate = (e) => {
    if (!viewAdded) {
      if (!vid.info?.duration || vid.info?.duration < 10) {
        setViewAdded(true)
        VideoService.addView(vid?.video_id || videoId).catch((err) => console.error(err))
      } else if (e.playedSeconds >= 10) {
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
      <Modal open={open} onClose={onClose} closeAfterTransition disableAutoFocus={true}>
        <Slide in={open}>
          <Paper sx={{ height: '100%', borderRadius: '0px', overflowY: 'auto', background: 'rgba(0, 0, 0, 0.4)' }}>
            <IconButton
              color="inherit"
              onClick={onClose}
              aria-label="close"
              sx={{
                position: 'absolute',
                background: 'rgba(255,255,255,0.25)',
                ':hover': {
                  background: 'rgba(255,255,255,0.5)',
                },
                width: 50,
                height: 50,
                top: 16,
                right: 16,
                zIndex: 100,
                padding: 0,
              }}
            >
              <CloseIcon sx={{ width: 35, height: 35 }} />
            </IconButton>
            <Grid container justifyContent="center">
              <Grid item xs={12}>
                <ReactPlayer
                  ref={playerRef}
                  width="100%"
                  height="auto"
                  url={`${
                    SERVED_BY === 'nginx'
                      ? `${URL}/_content/video/${getVideoPath(vid.video_id, vid.extension)}`
                      : `${URL}/api/video/stream/${vid.video_id}/video.m3u8`
                  }`}
                  pip={false}
                  controls
                  playing
                  onProgress={handleTimeUpdate}
                />
              </Grid>
              <Grid item>
                <ButtonGroup variant="contained" onClick={(e) => e.stopPropagation()}>
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
                  <Paper sx={{ mt: 1, background: 'rgba(50, 50, 50, 0.9)' }}>
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
                      rows={2}
                      multiline
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Paper>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Slide>
      </Modal>
    </>
  )
}

export default VideoModal
