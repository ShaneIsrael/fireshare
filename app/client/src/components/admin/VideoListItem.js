import React from 'react'
import { Grid, IconButton, InputAdornment, Paper, TextField, Tooltip, Typography } from '@mui/material'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import Zoom from '@mui/material/Zoom'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, toHHMMSS, useDebounce } from '../../common/utils'
import { VideoService } from '../../services'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'

const URL = getPublicWatchUrl()

const VideoListItem = ({ video, openVideoHandler, alertHandler, feedView, authenticated }) => {
  const [videoId, setVideoId] = React.useState(video.video_id)
  const [title, setTitle] = React.useState(video.info?.title)
  const [description, setDescription] = React.useState(video.info?.description)

  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [privateView, setPrivateView] = React.useState(video.info?.private)

  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false)

  const previousVideoIdRef = React.useRef()
  const previousVideoId = previousVideoIdRef.current
  if (video.video_id !== previousVideoId && video.video_id !== videoId) {
    setVideoId(video.video_id)
    setTitle(video.info?.title)
    setDescription(video.info?.description)
    setPrivateView(video.info?.private)
    setUpdatedTitle(null)
  }
  React.useEffect(() => {
    previousVideoIdRef.current = video.video_id
  })

  React.useEffect(() => {
    async function update() {
      try {
        await VideoService.updateTitle(video.video_id, debouncedTitle)
        setTitle(updatedTitle)
        alertHandler({
          type: 'success',
          message: 'Title Updated',
          open: true,
        })
      } catch (err) {
        alertHandler({
          type: 'error',
          message: 'An error occurred trying to update the title',
          open: true,
        })
      }
    }
    if (debouncedTitle && debouncedTitle !== title) {
      update()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedTitle])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${URL}${video.video_id}`, '_blank')
    }
  }

  const handlePrivacyChange = async () => {
    try {
      await VideoService.updatePrivacy(video.video_id, !privateView)
      alertHandler({
        type: privateView ? 'info' : 'warning',
        message: privateView ? `Added to your public feed` : `Removed from your public feed`,
        open: true,
      })
      setPrivateView(!privateView)
    } catch (err) {
      console.log(err)
    }
  }

  const handleDetailsModalClose = (update) => {
    setDetailsModalOpen(false)
    if (update) {
      if (update.title !== title) setTitle(update.title)
      if (update.description !== description) setDescription(update.description)
    }
  }

  return (
    <Paper square sx={{ height: 70, bgcolor: '#0b132b', borderBottom: '1px solid #046595' }}>
      <UpdateDetailsModal
        open={detailsModalOpen}
        close={handleDetailsModalClose}
        videoId={video.video_id}
        currentTitle={title || ''}
        currentDescription={description || ''}
        alertHandler={alertHandler}
      />
      <Grid container direction="column" sx={{ width: '100%', height: '100%' }}>
        <Grid container sx={{ width: 25, height: '100%', pl: 2 }} justifyContent="center" alignItems="center">
          <Grid item>
            <CopyToClipboard text={`${URL}${video.video_id}`}>
              <IconButton
                aria-label="play video"
                sx={{ width: 30, height: 30 }}
                onMouseDown={handleMouseDown}
                onClick={() =>
                  alertHandler({
                    open: true,
                    message: 'Link copied to clipboard',
                    type: 'info',
                  })
                }
              >
                <LinkIcon sx={{ width: 25, height: 25 }} color="primary" />
              </IconButton>
            </CopyToClipboard>
          </Grid>
        </Grid>
        {authenticated && (
          <Grid container sx={{ width: 25, height: '100%', pl: 2 }} justifyContent="center" alignItems="center">
            <Tooltip
              title="Toggle visibility on your public feed."
              placement="top"
              enterDelay={1000}
              TransitionComponent={Zoom}
            >
              <IconButton
                sx={{
                  color: privateView ? 'red' : '#2684FF',
                }}
                onClick={handlePrivacyChange}
                edge="end"
              >
                {privateView ? <VisibilityOffIcon /> : <VisibilityIcon />}
              </IconButton>
            </Tooltip>
          </Grid>
        )}
        <Grid
          container
          sx={{ width: `calc(100% - (75px + ${authenticated ? 25 : 0}px))`, height: '100%', pl: 3 }}
          alignItems="center"
        >
          <Grid item xs>
            <TextField
              fullWidth
              size="small"
              value={updatedTitle !== null ? updatedTitle : title}
              disabled={!authenticated}
              onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
              InputProps={{
                startAdornment: authenticated && (
                  <InputAdornment position="start">
                    <IconButton size="small" onClick={() => setDetailsModalOpen(true)} edge="start">
                      <EditIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item sx={{ pl: 1, pr: 1 }}>
            <Typography sx={{ fontWeight: 400, fontSize: 20, fontFamily: 'monospace' }}>
              {toHHMMSS(video.info.duration)}
            </Typography>
          </Grid>
        </Grid>
        <Grid container sx={{ width: 50, height: '100%' }} justifyContent="center" alignItems="center">
          <IconButton
            aria-label="play video"
            sx={{ width: 50, height: 50 }}
            onClick={() => openVideoHandler(video.video_id)}
          >
            <PlayCircleIcon sx={{ width: 40, height: 40 }} color="primary" />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default VideoListItem
