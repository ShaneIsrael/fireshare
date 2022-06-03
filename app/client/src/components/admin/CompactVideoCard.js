import React from 'react'
import { Card, CardContent, IconButton, InputAdornment, TextField, Tooltip, Typography } from '@mui/material'
import Zoom from '@mui/material/Zoom'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import LinkIcon from '@mui/icons-material/Link'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, useDebounce } from '../../common/utils'
import VideoService from '../../services/VideoService'
import _ from 'lodash'
import { Box } from '@mui/system'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const CompactVideoCard = ({
  video,
  openVideoHandler,
  alertHandler,
  selectedHandler,
  selected,
  cardWidth,
  feedView,
  authenticated,
}) => {
  const [videoId, setVideoId] = React.useState(video.video_id)
  const [title, setTitle] = React.useState(video.info?.title)
  const [description, setDescription] = React.useState(video.info?.description)
  const [showBoomerang, setShowBoomerang] = React.useState(true)
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [hover, setHover] = React.useState(false)
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

  const handleDetailsModalClose = (update) => {
    setDetailsModalOpen(false)
    if (update) {
      if (update.title !== title) setTitle(update.title)
      if (update.description !== description) setDescription(update.description)
    }
  }

  const handleBoomerangError = (e) => {
    setShowBoomerang(false)
  }

  const previewVideoHeight =
    video.info?.width && video.info?.height ? cardWidth * (video.info.height / video.info.width) : cardWidth / 1.77

  return (
    <>
      <UpdateDetailsModal
        open={detailsModalOpen}
        close={handleDetailsModalClose}
        videoId={video.video_id}
        currentTitle={title || ''}
        currentDescription={description || ''}
        alertHandler={alertHandler}
      />

      <Card
        sx={{
          width: '100%',
          bgcolor: '#0b132b',
          border: selected ? '1px solid #fffc31' : '1px solid #3399FFAE',
        }}
        square
      >
        <Tooltip title={title || ''} placement="bottom" enterDelay={1000} leaveDelay={500} enterNextDelay={1000} arrow>
          <TextField
            fullWidth
            size="small"
            value={updatedTitle !== null ? updatedTitle : title}
            disabled={!authenticated}
            onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
            sx={{
              border: 'none',
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
              },
              '& .MuiInputBase-input.Mui-disabled': {
                WebkitTextFillColor: '#fff',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderTop: '1px solid rgba(0, 0, 0, 0)',
                borderLeft: '1px solid rgba(0, 0, 0, 0)',
                borderRight: '1px solid rgba(0, 0, 0, 0)',
                borderBottom: '1px solid #3399FFAE',
              },
            }}
            InputProps={{
              startAdornment: authenticated && (
                <InputAdornment position="start">
                  <IconButton size="small" onClick={() => setDetailsModalOpen(true)} edge="start">
                    <EditIcon />
                  </IconButton>
                </InputAdornment>
              ),
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
              openVideoHandler(video.video_id)
            }}
            onMouseEnter={debouncedMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
          >
            {showBoomerang === true ? (
              <video
                width={cardWidth}
                height={previewVideoHeight}
                src={`${
                  SERVED_BY === 'nginx'
                    ? `${URL}/_content/derived/${video.video_id}/boomerang-preview.webm`
                    : `${URL}/api/video/poster?id=${video.video_id}&animated=true`
                }`}
                onError={handleBoomerangError}
                muted
                autoPlay
                loop
                disablePictureInPicture
              />
            ) : (
              <img
                src={`${
                  SERVED_BY === 'nginx'
                    ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
                    : `${URL}/api/video/poster?id=${video.video_id}`
                }`}
                alt=""
                style={{
                  width: cardWidth,
                }}
              />
            )}
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
                width={cardWidth}
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
    </>
  )
}

export default CompactVideoCard
