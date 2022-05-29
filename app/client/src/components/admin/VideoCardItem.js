import React from 'react'
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Grid,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import Zoom from '@mui/material/Zoom'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, useDebounce } from '../../common/utils'
import VideoService from '../../services/VideoService'
import _ from 'lodash'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const VideoCardItem = ({
  video,
  openVideoHandler,
  alertHandler,
  selectedHandler,
  selected,
  visible,
  cardWidth,
  feedView,
  authenticated,
}) => {
  const title = video.info?.title
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [hover, setHover] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(video.info?.private)

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
  }, [debouncedTitle, title, video.video_id, alertHandler])

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${video.video_id}`, '_blank')
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

  const previewVideoWidth = cardWidth
  const previewVideoHeight =
    video.info?.width && video.info?.height ? previewVideoWidth * (video.info.height / video.info.width) : 216
  if (!visible)
    return (
      <div
        // calculate the rendered cards height based on the video dimesions and our css styling heights
        style={{
          width: previewVideoWidth,
          background: '#000e393b',
          height: video.info?.width && video.info?.height ? previewVideoHeight + 100 : 316,
        }}
      />
    )

  return (
    <Card
      sx={{
        width: previewVideoWidth,
        bgcolor: '#0b132b',
        border: selected ? '2px solid #fffc31' : '1px solid #3399FF',
        m: 1,
      }}
      square
    >
      <div
        style={{ position: 'relative', cursor: 'pointer', width: '100%', overflow: 'hidden' }}
        onClick={() => {
          selectedHandler(video.video_id)
          openVideoHandler(video)
        }}
        onMouseEnter={debouncedMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        <img
          src={`${
            SERVED_BY === 'nginx'
              ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
              : `${URL}/api/video/poster?id=${video.video_id}`
          }`}
          alt=""
          style={{
            width: previewVideoWidth,
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
            width={previewVideoWidth}
            height={previewVideoHeight}
            src={`${
              SERVED_BY === 'nginx'
                ? `${URL}/_content/video/${video.video_id}${video.extension}`
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
          disabled={!authenticated}
          onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 0 } }}
          InputProps={{
            endAdornment: authenticated && (
              <InputAdornment position="end">
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
              </InputAdornment>
            ),
          }}
        />
      </CardContent>
      <CardActions sx={{ height: 50 }}>
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
                onMouseDown={handleMouseDown}
              >
                Copy Link
              </Button>
            </CopyToClipboard>
          </Grid>
          <Grid
            item
            sx={{
              mr: 1.1,
              mt: 0.5,
            }}
          >
            <Typography variant="div" color="primary" sx={{ fontWeight: 700, fontSize: 12, fontFamily: 'monospace' }}>
              {new Date(video.info.duration * 1000).toISOString().substr(11, 8)}
            </Typography>
          </Grid>
        </Grid>
      </CardActions>
    </Card>
  )
}

export default VideoCardItem
