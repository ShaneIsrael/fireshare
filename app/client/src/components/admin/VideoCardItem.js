import React from 'react'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardActions,
  CardContent,
  CardMedia,
  Grid,
  TextField,
  Typography,
} from '@mui/material'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, useDebounce } from '../../common/utils'
import VideoService from '../../services/VideoService'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoCardItem = ({ video, openVideoHandler, alertHandler }) => {
  const title = video.info?.title
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)

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

  return (
    <Card sx={{ width: 300, bgcolor: '#0b132b', border: '1px solid #046595' }} square elevation={2}>
      <CardActionArea onClick={() => openVideoHandler(video)}>
        <CardMedia
          component="img"
          image={`${
            SERVED_BY === 'nginx'
              ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
              : `${URL}/api/video/poster?id=${video.video_id}`
          }`}
        />
        {/* <Box
          sx={{
            pr: 1,
            pl: 1,
            position: 'absolute',
            top: '20px',
            left: '50%',
            background: 'rgba(0, 0, 0, 0.9)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 20,
              fontFamily: 'monospace',
              color: '#fff',
            }}
          >
            {new Date(video.info.duration * 1000).toISOString().substr(11, 8)}
          </Typography>
        </Box> */}
      </CardActionArea>
      <CardContent sx={{ height: 55 }}>
        <TextField
          fullWidth
          size="small"
          label="Title"
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
