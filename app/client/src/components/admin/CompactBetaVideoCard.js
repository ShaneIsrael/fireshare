import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, getVideoUrl, getSetting } from '../../common/utils'
import { GameService, VideoService } from '../../services'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'
import { FastAverageColor } from 'fast-average-color'
import _ from 'lodash'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const fac = new FastAverageColor()
const gameColorCache = {} // keyed by steamgriddb_id

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s
  const l = (max + min) / 2
  if (max === min) {
    h = s = 0
  } else {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      default: h = ((r - g) / d + 4) / 6
    }
  }
  return [h * 360, s * 100, l * 100]
}

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
  const [gameSuggestion, setGameSuggestion] = React.useState(null)
  const [showSuggestion, setShowSuggestion] = React.useState(true)
  const [suggestionLoading, setSuggestionLoading] = React.useState(false)
  const [suggestionIcon, setSuggestionIcon] = React.useState(null)
  const [cardColor, setCardColor] = React.useState(null)

  const uiConfig = getSetting('ui_config')
  const canTagGames = authenticated || uiConfig?.allow_public_game_tag

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

  React.useEffect(() => {
    if (!game?.icon_url || !game?.steamgriddb_id) return
    const cacheKey = game.steamgriddb_id
    if (gameColorCache[cacheKey]) {
      setCardColor(gameColorCache[cacheKey])
      return
    }
    fac.getColorAsync(game.icon_url, { crossOrigin: 'anonymous', algorithm: 'sqrt' })
      .then((color) => {
        if (color.error) return
        const [r, g, b] = color.value
        const [h, s] = rgbToHsl(r, g, b)
        const tint = `hsla(${h}, ${Math.max(s, 55)}%, 12%, 0.85)`
        gameColorCache[cacheKey] = tint
        setCardColor(tint)
      })
      .catch(() => {})
  }, [game])

  React.useEffect(() => {
    VideoService.getGameSuggestion(video.video_id)
      .then((response) => {
        if (response.data) {
          setGameSuggestion(response.data)
          setShowSuggestion(true)
          if (response.data.steamgriddb_id) {
            GameService.getGameAssets(response.data.steamgriddb_id)
              .then((assets) => { if (assets.data?.icon_url) setSuggestionIcon(assets.data.icon_url) })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
  }, [video.video_id])

  const handleSuggestionAccept = async () => {
    setSuggestionLoading(true)
    try {
      let gameId = gameSuggestion.game_id
      if (!gameId && gameSuggestion.steamgriddb_id) {
        const assets = (await GameService.getGameAssets(gameSuggestion.steamgriddb_id)).data
        const createdGame = (await GameService.createGame({
          steamgriddb_id: gameSuggestion.steamgriddb_id,
          name: gameSuggestion.game_name,
          hero_url: assets.hero_url,
          logo_url: assets.logo_url,
          icon_url: assets.icon_url,
        })).data
        gameId = createdGame.id
      }
      await GameService.linkVideoToGame(video.video_id, gameId)
      await VideoService.rejectGameSuggestion(video.video_id)
      const gameResponse = await GameService.getVideoGame(video.video_id)
      if (gameResponse.data) setGame(gameResponse.data)
      setShowSuggestion(false)
      setGameSuggestion(null)
    } catch (err) {
      console.error('Failed to accept game suggestion:', err)
      setSuggestionLoading(false)
    }
  }

  const handleSuggestionReject = async () => {
    setSuggestionLoading(true)
    try {
      await VideoService.rejectGameSuggestion(video.video_id)
      setShowSuggestion(false)
      setTimeout(() => setGameSuggestion(null), 300)
    } catch (err) {
      console.error('Failed to reject game suggestion:', err)
      setSuggestionLoading(false)
    }
  }

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
        bgcolor: cardColor || 'transparent',
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'background-color 0.4s ease',
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ overflow: 'hidden' }}>
      <motion.div
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

        {/* Views badge - bottom left, hides on hover to give way to copy link */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            bgcolor: 'rgba(0, 0, 0, 0.75)',
            borderRadius: '4px',
            px: 0.75,
            py: 0.25,
            opacity: thumbnailHover ? 0 : 1,
            transition: 'opacity 0.2s ease-in-out',
          }}
        >
          <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'white' }}>
            {viewCount} {viewCount === 1 ? 'view' : 'views'}
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
          px: 1.5,
          pb: 1.5,
          gap: 1.5,
        }}
      >
        {/* Game icon — only shown when a game is linked */}
        {game?.icon_url && (
          <a
            href={`#/games/${game.steamgriddb_id}`}
            onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0, lineHeight: 0 }}
          >
            <img
              src={game.icon_url}
              alt={game.name}
              style={{ width: 40, height: 40, objectFit: 'contain', display: 'block' }}
            />
          </a>
        )}

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
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </Typography>

          {/* Game name */}
          {gameName && (
            <Typography
              component={game?.steamgriddb_id ? 'a' : 'span'}
              href={game?.steamgriddb_id ? `#/games/${game.steamgriddb_id}` : undefined}
              onClick={game?.steamgriddb_id ? (e) => e.stopPropagation() : undefined}
              sx={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.7)',
                mt: 0.25,
                display: 'block',
                textDecoration: 'none',
                ...(game?.steamgriddb_id && {
                  '&:hover': { color: '#3399FF', textDecoration: 'underline' },
                }),
              }}
            >
              {gameName}
            </Typography>
          )}

          {/* Recorded date */}
          {video.recorded_at && (
            <Typography
              sx={{
                fontSize: 14,
                color: 'rgba(255, 255, 255, 0.5)',
                mt: 0.25,
              }}
            >
              {new Date(video.recorded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Typography>
          )}
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
          <MoreVertIcon sx={{ fontSize: 24 }} />
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

      {/* Game detection suggestion bar */}
      <AnimatePresence>
        {canTagGames && gameSuggestion && showSuggestion && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                mx: 1.5,
                mb: 1.5,
                px: 1.5,
                py: 0.75,
                bgcolor: '#0b132b',
                border: '1px solid #3399FF40',
                borderRadius: '8px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                {suggestionIcon && (
                  <img
                    src={suggestionIcon}
                    alt=""
                    style={{ width: 20, height: 20, borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }}
                  />
                )}
                <Typography
                  sx={{
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.85)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Game Detected: <strong>{gameSuggestion.game_name}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                <IconButton
                  size="small"
                  onClick={handleSuggestionAccept}
                  disabled={suggestionLoading}
                  sx={{ color: '#4caf50', bgcolor: 'rgba(76,175,80,0.1)', '&:hover': { bgcolor: 'rgba(76,175,80,0.2)' }, width: 26, height: 26 }}
                >
                  <CheckIcon sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={handleSuggestionReject}
                  disabled={suggestionLoading}
                  sx={{ color: '#f44336', bgcolor: 'rgba(244,67,54,0.1)', '&:hover': { bgcolor: 'rgba(244,67,54,0.2)' }, width: 26, height: 26 }}
                >
                  <CloseIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
    </>
  )
}

export default CompactBetaVideoCard
