import React from 'react'
import { Button, ButtonGroup, Grid, IconButton, InputBase, Typography, Box } from '@mui/material'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import EditIcon from '@mui/icons-material/Edit'
import LinkIcon from '@mui/icons-material/Link'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, useDebounce, getVideoPath } from '../../common/utils'
import VideoService from '../../services/VideoService'
import _ from 'lodash'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'
import LightTooltip from '../misc/LightTooltip'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const CompactVideoCard = ({ video, openVideoHandler, alertHandler, cardWidth, authenticated, deleted }) => {
  const [intVideo, setIntVideo] = React.useState(video)
  const [videoId, setVideoId] = React.useState(video.video_id)
  const [title, setTitle] = React.useState(video.info?.title)
  const [description, setDescription] = React.useState(video.info?.description)
  const [updatedTitle, setUpdatedTitle] = React.useState(null)
  const debouncedTitle = useDebounce(updatedTitle, 1500)
  const [hover, setHover] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(video.info?.private)

  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false)

  const previousVideoRef = React.useRef()
  const previousVideo = previousVideoRef.current
  if (!_.isEqual(video, previousVideo) && !_.isEqual(video, intVideo)) {
    setIntVideo(video)
    setVideoId(video.video_id)
    setTitle(video.info?.title)
    setDescription(video.info?.description)
    setPrivateView(video.info?.private)
    setUpdatedTitle(null)
  }
  React.useEffect(() => {
    previousVideoRef.current = video
  })

  const debouncedMouseEnter = React.useRef(
    _.debounce(() => {
      setHover(true)
    }, 750),
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
      if (update === 'delete') {
        deleted(videoId)
      } else {
        if (update.title !== title) setTitle(update.title)
        if (update.description !== description) setDescription(update.description)
      }
    }
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

      <Box
        sx={{
          width: '100%',
          bgcolor: 'rgba(0, 0, 0, 0)',
          lineHeight: 0,
        }}
      >
        <ButtonGroup
          variant="contained"
          size="small"
          sx={{
            width: '100%',
            background: '#0b132b',

            borderRadius: '6px',
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            borderLeft: '1px solid #3399FFAE',
            borderTop: '1px solid #3399FFAE',
            borderRight: '1px solid #3399FFAE',
            '.MuiButtonGroup-grouped:not(:last-of-type)': {
              border: 'none',
            },
          }}
        >
          {authenticated && (
            <Button
              onClick={() => setDetailsModalOpen(true)}
              sx={{
                bgcolor: 'rgba(0,0,0,0)',
                borderBottomLeftRadius: 0,
                borderTopLeftRadius: '6px',
                m: 0,
              }}
            >
              <EditIcon />
            </Button>
          )}
          <LightTooltip
            title={title || ''}
            placement="bottom"
            enterDelay={1000}
            leaveDelay={500}
            enterNextDelay={1000}
            arrow
          >
            <InputBase
              sx={{
                pl: authenticated ? 0 : 1.5,
                pr: 1.5,
                width: cardWidth,
                bgcolor: 'rgba(0,0,0,0)',
                WebkitTextFillColor: '#fff',
                fontWeight: 575,
                '& .MuiInputBase-input.Mui-disabled': {
                  WebkitTextFillColor: '#fff',
                  fontWeight: 575,
                },
              }}
              placeholder="Video Title..."
              value={updatedTitle !== null ? updatedTitle : title}
              onChange={(e) => authenticated && setUpdatedTitle(e.target.value)}
              disabled={!authenticated}
              inputProps={{ 'aria-label': 'search google maps' }}
            />
          </LightTooltip>
          {authenticated && (
            <Button
              onClick={handlePrivacyChange}
              edge="end"
              sx={{
                borderBottomRightRadius: 0,
                borderTopRightRadius: '6px',
                bgcolor: 'rgba(0,0,0,0)',
                color: privateView ? '#FF2323B2' : '#2382FFB7',
                ':hover': {
                  bgcolor: privateView ? '#FF232340' : '#2382FF40',
                },
              }}
            >
              {privateView ? <VisibilityOffIcon /> : <VisibilityIcon />}
            </Button>
          )}
        </ButtonGroup>
        <Box
          sx={{
            lineHeight: 0,
            bgcolor: 'rgba(0,0,0,0)',
            p: 0,
            '&:last-child': { p: 0 },
          }}
        >
          <div
            style={{ position: 'relative', cursor: 'pointer' }}
            onClick={() => openVideoHandler(video.video_id)}
            onMouseEnter={debouncedMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
          >
            {!video.available && (
              <Box
                sx={{ position: 'absolute', top: 0, left: 0, background: '#FF000060', width: '100%', height: '100%' }}
              >
                <Grid container direction="row" alignItems="center" sx={{ width: '100%', height: '100%' }}>
                  <Typography
                    variant="overline"
                    sx={{
                      width: '100%',
                      fontSize: 28,
                      fontWeight: 750,
                    }}
                    align="center"
                  >
                    File Missing
                  </Typography>
                </Grid>
              </Box>
            )}
            <img
              src={`${
                SERVED_BY === 'nginx'
                  ? `${URL}/_content/derived/${video.video_id}/poster.jpg`
                  : `${URL}/api/video/poster?id=${video.video_id}`
              }`}
              alt=""
              style={{
                width: cardWidth,
                border: '1px solid #3399FFAE',
                borderBottomRightRadius: '6px',
                borderBottomLeftRadius: '6px',
                borderTop: 'none',
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
                  border: '1px solid #3399FFAE',
                  borderBottomRightRadius: '6px',
                  borderBottomLeftRadius: '6px',
                  borderTop: 'none',
                }}
                width={cardWidth}
                height={previewVideoHeight}
                src={`${
                  SERVED_BY === 'nginx'
                    ? `${URL}/_content/video/${getVideoPath(video.video_id, video.extension)}`
                    : `${URL}/api/video?id=${video.extension === '.mkv' ? `${video.video_id}&subid=1` : video.video_id}`
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
            <Box sx={{ position: 'absolute', bottom: 39, right: 3 }}>
              <Typography
                variant="div"
                color="white"
                sx={{
                  p: 0.5,
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '4px',
                }}
              >
                {toHHMMSS(video.info.duration)}
              </Typography>
            </Box>
            <Box sx={{ position: 'absolute', bottom: 14, right: 3 }}>
              <Typography
                variant="div"
                color="white"
                sx={{
                  p: 0.5,
                  fontWeight: 700,
                  fontSize: 12,
                  fontFamily: 'monospace',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '4px',
                }}
              >
                {`${video.view_count} ${video.view_count === 1 ? 'View' : 'Views'}`}
              </Typography>
            </Box>
          </div>
        </Box>
      </Box>
    </>
  )
}

export default CompactVideoCard
