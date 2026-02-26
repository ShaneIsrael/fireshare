import React from 'react'
import { motion } from 'framer-motion'
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, getVideoUrl } from '../../common/utils'
import { GameService, VideoService } from '../../services'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'
import _ from 'lodash'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const CompactBetaVideoCard = ({
  video,
  openVideoHandler,
  cardWidth,
  alertHandler,
  authenticated,
}) => {
  const [intVideo, setIntVideo] = React.useState(video)
  const [hover, setHover] = React.useState(false)
  const [thumbnailHover, setThumbnailHover] = React.useState(false)
  const [game, setGame] = React.useState(null)
  const [privateView, setPrivateView] = React.useState(video.info?.private)
  const [title, setTitle] = React.useState(video.info?.title || 'Untitled')
  const [description, setDescription] = React.useState(video.info?.description || '')
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false)
  const menuOpen = Boolean(menuAnchorEl)

  const previousVideoRef = React.useRef()
  const previousVideo = previousVideoRef.current
  if (!_.isEqual(video, previousVideo) && !_.isEqual(video, intVideo)) {
    setIntVideo(video)
    setTitle(video.info?.title || 'Untitled')
    setDescription(video.info?.description || '')
  }
  React.useEffect(() => {
    previousVideoRef.current = video
  })

  React.useEffect(() => {
    GameService.getVideoGame(video.video_id)
      .then((response) => {
        if (response.data) {
          setGame(response.data)
        }
      })
      .catch(() => {
        // No game linked
      })
  }, [video.video_id])

  const debouncedMouseEnter = React.useRef(
    _.debounce(() => {
      setHover(true)
    }, 750),
  ).current

  const handleMouseLeave = () => {
    debouncedMouseEnter.cancel()
    setHover(false)
  }

  const handleMouseDown = (e) => {
    if (e.button === 1) {
      window.open(`${PURL}${video.video_id}`, '_blank')
    }
  }

  const handlePrivacyChange = async (e) => {
    e.stopPropagation()
    try {
      await VideoService.updatePrivacy(video.video_id, !privateView)
      alertHandler?.({
        type: privateView ? 'info' : 'warning',
        message: privateView ? 'Added to your public feed' : 'Removed from your public feed',
        open: true,
      })
      setPrivateView(!privateView)
    } catch (err) {
      console.log(err)
    }
  }

  const previewVideoHeight =
    video.info?.width && video.info?.height ? cardWidth * (video.info.height / video.info.width) : cardWidth / 1.77

  const getPreviewVideoUrl = () => {
    const has720p = video.info?.has_720p
    const has1080p = video.info?.has_1080p

    if (has720p) {
      return getVideoUrl(video.video_id, '720p', video.extension)
    }

    if (has1080p) {
      return getVideoUrl(video.video_id, '1080p', video.extension)
    }

    return getVideoUrl(video.video_id, 'original', video.extension)
  }

  const gameName = game?.name || ''
  const viewCount = video.view_count || 0

  const handleDetailsModalClose = (update) => {
    setDetailsModalOpen(false)
    if (update && update !== 'delete') {
      if (update.title !== undefined) setTitle(update.title || 'Untitled')
      if (update.description !== undefined) setDescription(update.description || '')
    }
  }

  return (
    <>
    <UpdateDetailsModal
      open={detailsModalOpen}
      close={handleDetailsModalClose}
      videoId={video.video_id}
      currentTitle={title}
      currentDescription={description}
      currentRecordedAt={video.recorded_at}
      alertHandler={alertHandler}
    />
    <Box
      sx={{
        width: cardWidth,
        bgcolor: 'transparent',
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ borderRadius: '8px', overflow: 'hidden' }}>
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        style={{ position: 'relative', cursor: 'pointer' }}
        onClick={() => openVideoHandler(video.video_id)}
        onMouseEnter={(e) => {
          setThumbnailHover(true)
          debouncedMouseEnter(e)
        }}
        onMouseLeave={() => {
          setThumbnailHover(false)
          handleMouseLeave()
        }}
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
            width: cardWidth,
            minHeight: previewVideoHeight,
            borderRadius: '8px',
            background: 'repeating-linear-gradient(45deg,#606dbc,#606dbc 10px,#465298 10px,#465298 20px)',
            display: 'block',
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
              borderRadius: '8px',
            }}
            width={cardWidth}
            height={previewVideoHeight}
            src={getPreviewVideoUrl()}
            muted
            autoPlay
            disablePictureInPicture
          />
        )}

        {/* Duration badge */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            bgcolor: 'rgba(0, 0, 0, 0.75)',
            borderRadius: '4px',
            px: 0.75,
            py: 0.25,
          }}
        >
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: 14,
              color: 'white',
            }}
          >
            {toHHMMSS(video.info?.duration)}
          </Typography>
        </Box>

        {/* Copy link button - shows on hover */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            opacity: thumbnailHover ? 1 : 0,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          <CopyToClipboard text={`${PURL}${video.video_id}`}>
            <IconButton
              sx={{
                background: 'rgba(0, 0, 0, 0.6)',
                '&:hover': {
                  background: '#2684FF88',
                },
              }}
              aria-label="copy link"
              size="small"
              onClick={(e) => {
                e.stopPropagation()
                alertHandler?.({
                  type: 'info',
                  message: 'Link copied to clipboard',
                  open: true,
                })
              }}
            >
              <LinkIcon sx={{ color: 'white', fontSize: 24 }} />
            </IconButton>
          </CopyToClipboard>
        </Box>

        {/* Visibility toggle button - shows on hover when authenticated */}
        {authenticated && (
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              opacity: thumbnailHover ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            <IconButton
              sx={{
                background: 'rgba(0, 0, 0, 0.6)',
                '&:hover': {
                  background: privateView ? '#FF232360' : '#2684FF88',
                },
              }}
              aria-label="toggle visibility"
              size="small"
              onClick={handlePrivacyChange}
            >
              {privateView ? (
                <VisibilityOffIcon sx={{ color: '#FF6B6B', fontSize: 24 }} />
              ) : (
                <VisibilityIcon sx={{ color: 'white', fontSize: 24 }} />
              )}
            </IconButton>
          </Box>
        )}
      </motion.div>
      </Box>

      {/* Info section below thumbnail */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          mt: 1.5,
          gap: 1.5,
        }}
      >
        {/* Game icon */}
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            overflow: 'hidden',
            flexShrink: 0,
            bgcolor: 'rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {game?.icon_url ? (
            <img
              src={game.icon_url}
              alt={game.name}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                bgcolor: 'rgba(100, 100, 150, 0.5)',
              }}
            />
          )}
        </Box>

        {/* Text info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {/* Title */}
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1.3,
              color: 'white',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {title}
          </Typography>

          {/* Game name */}
          {gameName && (
            <Typography
              sx={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.7)',
                mt: 0.25,
              }}
            >
              {gameName}
            </Typography>
          )}

          {/* Views */}
          <Typography
            sx={{
              fontSize: 14,
              color: 'rgba(255, 255, 255, 0.5)',
              mt: 0.25,
            }}
          >
            {viewCount} {viewCount === 1 ? 'view' : 'views'}
          </Typography>
        </Box>

        {/* 3-dot menu toggle */}
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); setMenuAnchorEl(e.currentTarget) }}
          sx={{
            alignSelf: 'flex-start',
            color: menuOpen ? 'primary.main' : 'rgba(255, 255, 255, 0.35)',
            transition: 'color 0.2s',
            p: 0.5,
            mt: 0.25,
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Floating context menu */}
      <Menu
        anchorEl={menuAnchorEl}
        open={menuOpen}
        onClose={() => setMenuAnchorEl(null)}
        onClick={(e) => e.stopPropagation()}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: '#0b132b',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              minWidth: 160,
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              mt: 0.5,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => { setDetailsModalOpen(true); setMenuAnchorEl(null) }}
          sx={{ gap: 1.5, py: 1.25, fontSize: 14, color: 'rgba(255,255,255,0.9)', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: '#3399FF' }}>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Info
        </MenuItem>
        <MenuItem
          onClick={() => setMenuAnchorEl(null)}
          sx={{ gap: 1.5, py: 1.25, fontSize: 14, color: 'rgba(255,255,255,0.5)', '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' } }}
        >
          <ListItemIcon sx={{ minWidth: 0, color: 'rgba(255,255,255,0.4)' }}>
            <SlowMotionVideoIcon fontSize="small" />
          </ListItemIcon>
          Transcode
        </MenuItem>
      </Menu>
    </Box>
    </>
  )
}

export default CompactBetaVideoCard
