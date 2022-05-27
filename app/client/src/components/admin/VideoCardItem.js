import React from 'react'
import { Box, Button, Card, CardActionArea, CardActions, CardContent, Grid, TextField, Typography } from '@mui/material'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, useDebounce } from '../../common/utils'
import VideoService from '../../services/VideoService'

import _ from 'lodash'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoCardItem = ({ video, openVideoHandler, alertHandler, selectedHandler, selected, visible }) => {
  const title = video.info?.title
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [hover, setHover] = React.useState(false)
  const debouncedMouseEnter = React.useRef(
    _.debounce(() => {
      setHover(true)
    }, 1000),
  ).current

  const handleMouseLeave = () => {
    debouncedMouseEnter.cancel()
    setHover(false)
  }

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
  }, [debouncedTitle, title, video.video_id])

  if (!visible) return <div style={{ width: 375, height: 316 }} />

  return (
    <Card sx={{ width: 375, bgcolor: '#0b132b', border: selected ? '3px solid #fffc31' : '1px solid #046595' }} square>
      <div
        style={{ position: 'relative', cursor: 'pointer', width: '100%', overflow: 'hidden' }}
        onClick={() => {
          selectedHandler(video.video_id)
          openVideoHandler(video)
        }}
        onMouseEnter={debouncedMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <img
          src={`${
            SERVED_BY === 'nginx'
              ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
              : `${URL}/api/video/poster?id=${video.video_id}`
          }`}
          style={{
            width: 375,
            height: 'auto',
            position: 'relative',
            top: 0,
            left: 0,
          }}
        />
        {hover && (
          <video
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: 0,
              animationName: 'fadeIn',
              animationDuration: '1.5s',
              animationFillMode: 'both',
              WebkitAnimationName: 'fadeIn',
              WebkitAnimationDuration: '1.5s',
              WebkitAnimationFillMode: 'both',
            }}
            width={'100%'}
            height={'auto'}
            src={`${
              SERVED_BY === 'nginx'
                ? `${URL}/_content/video/${video.video_id}.mp4`
                : `${URL}/api/video?id=${video.video_id}`
            }`}
            muted
            autoPlay
            disablePictureInPicture
          />
        )}
      </div>
      <CardContent sx={{ height: 50 }}>
        <TextField
          fullWidth
          size="small"
          defaultValue={updatedTitle || title}
          onChange={(e) => setUpdatedTitle(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
        />
      </CardContent>
      <CardActions>
        <Grid container>
          <Grid item xs>
            <CopyToClipboard text={`${PURL}${video.video_id}`}>
              <Button
                sx={{ ml: 0.05 }}
                size="small"
                onClick={() =>
                  alertHandler({
                    type: 'info',
                    message: 'Link copied to clipboard',
                    open: true,
                  })
                }
              >
                Copy Link
              </Button>
            </CopyToClipboard>
          </Grid>
          <Grid item>
            <Typography
              variant="div"
              color="primary"
              sx={{ mr: 1.1, fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}
            >
              {new Date(video.info.duration * 1000).toISOString().substr(11, 8)}
            </Typography>
          </Grid>
        </Grid>
      </CardActions>
    </Card>
  )
}

export default VideoCardItem
