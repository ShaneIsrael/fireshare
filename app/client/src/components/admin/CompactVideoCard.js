import React from 'react'
import { Card, CardContent, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material'
import Zoom from '@mui/material/Zoom'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import LinkIcon from '@mui/icons-material/Link'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, useDebounce } from '../../common/utils'
import VideoService from '../../services/VideoService'
import _ from 'lodash'
import { Box } from '@mui/system'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const CompactVideoCard = ({
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
        border: selected ? '1px solid #fffc31' : 'none',
        m: 1,
      }}
      square
      elevation={5}
    >
      <Tooltip title={title} placement="bottom" enterDelay={1000} leaveDelay={500} enterNextDelay={1000} arrow>
        <TextField
          fullWidth
          size="small"
          defaultValue={updatedTitle || title}
          disabled={!authenticated}
          onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
          sx={{
            border: 'none',
            '& .MuiOutlinedInput-root': { borderRadius: 0 },
            '& .MuiInputBase-input.Mui-disabled': {
              WebkitTextFillColor: '#fff',
            },
          }}
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
      </Tooltip>

      <CardContent sx={{ lineHeight: 0, p: 0, '&:last-child': { p: 0 } }}>
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
          <Box sx={{ position: 'absolute', bottom: 3, left: 3 }}>
            <CopyToClipboard text={`${PURL}${video.video_id}`}>
              <IconButton
                sx={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  '&:hover': {
                    background: '#2684FF88',
                  },
                }}
                aria-label="copy link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  alertHandler({
                    type: 'info',
                    message: 'Link copied to clipboard',
                    open: true,
                  })
                }}
                onMouseDown={handleMouseDown}
              >
                <LinkIcon />
              </IconButton>
            </CopyToClipboard>
          </Box>
          <Box sx={{ position: 'absolute', bottom: 15, right: 3 }}>
            <Typography
              variant="div"
              color="white"
              sx={{
                p: 0.5,
                fontWeight: 700,
                fontSize: 12,
                fontFamily: 'monospace',
                background: 'rgba(0, 0, 0, 0.6)',
              }}
            >
              {toHHMMSS(video.info.duration)}
            </Typography>
          </Box>
        </div>
      </CardContent>
    </Card>
  )
}

export default CompactVideoCard
