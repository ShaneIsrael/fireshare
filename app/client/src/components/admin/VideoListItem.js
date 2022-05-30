import React from 'react'
import { Grid, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material'
import PlayCircleIcon from '@mui/icons-material/PlayCircle'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import Zoom from '@mui/material/Zoom'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, toHHMMSS, useDebounce } from '../../common/utils'
import { VideoService } from '../../services'

const URL = getPublicWatchUrl()

const VideoListItem = ({ video, openVideoHandler, alertHandler, feedView, authenticated }) => {
  const title = video.info?.title
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [privateView, setPrivateView] = React.useState(video.info?.private)

  React.useEffect(() => {
    async function update() {
      try {
        await VideoService.updateTitle(video.video_id, debouncedTitle)
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
  }, [debouncedTitle, title, video.video_id, alertHandler])

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

  return (
    <Paper square sx={{ height: 70, bgcolor: '#0b132b', borderBottom: '1px solid #046595' }}>
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
              defaultValue={updatedTitle || title}
              disabled={!authenticated}
              onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
            />
          </Grid>
          <Grid item sx={{ pl: 1, pr: 1 }}>
            <Typography sx={{ fontWeight: 400, fontSize: 20, fontFamily: 'monospace' }}>
              {toHHMMSS(video.info.duration)}
            </Typography>
          </Grid>
        </Grid>
        <Grid container sx={{ width: 50, height: '100%' }} justifyContent="center" alignItems="center">
          <IconButton aria-label="play video" sx={{ width: 50, height: 50 }} onClick={() => openVideoHandler(video)}>
            <PlayCircleIcon sx={{ width: 40, height: 40 }} color="primary" />
          </IconButton>
        </Grid>
      </Grid>
    </Paper>
  )
}

export default VideoListItem
