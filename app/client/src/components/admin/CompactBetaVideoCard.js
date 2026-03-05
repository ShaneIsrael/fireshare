import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import EditIcon from '@mui/icons-material/Edit'
import SlowMotionVideoIcon from '@mui/icons-material/SlowMotionVideo'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicWatchUrl, getServedBy, getUrl, toHHMMSS, getVideoUrl, getSetting } from '../../common/utils'
import { GameService, VideoService, ConfigService } from '../../services'
import UpdateDetailsModal from '../modal/UpdateDetailsModal'
import DeleteVideoModal from '../modal/DeleteVideoModal'
import _ from 'lodash'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

const CompactBetaVideoCard = ({
  video,
  openVideoHandler,
  alertHandler,
  authenticated,
  editMode = false,
  selected = false,
  onSelect,
  onDelete,
  fullWidth = false,
}) => {
  const [intVideo, setIntVideo] = React.useState(video)
  const [hover, setHover] = React.useState(false)
  const [thumbnailHover, setThumbnailHover] = React.useState(false)
  const [game, setGame] = React.useState(null)
  const [privateView, setPrivateView] = React.useState(video.info?.private)
  const [title, setTitle] = React.useState(video.info?.title || (video.path ? video.path.split('/').pop().replace(/\.[^/.]+$/, '') : 'Untitled'))
  const [description, setDescription] = React.useState(video.info?.description || '')
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [detailsModalOpen, setDetailsModalOpen] = React.useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const menuOpen = Boolean(menuAnchorEl)
  const [gameSuggestion, setGameSuggestion] = React.useState(null)
  const [showSuggestion, setShowSuggestion] = React.useState(true)
  const [suggestionLoading, setSuggestionLoading] = React.useState(false)
  const [suggestionIcon, setSuggestionIcon] = React.useState(null)
  const [editingTitle, setEditingTitle] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState(title)

  const uiConfig = getSetting('ui_config')
  const canTagGames = authenticated || uiConfig?.allow_public_game_tag

  const previousVideoRef = React.useRef()
  const previousVideo = previousVideoRef.current
  if (!_.isEqual(video, previousVideo) && !_.isEqual(video, intVideo)) {
    setIntVideo(video)
    setTitle(video.info?.title || (video.path ? video.path.split('/').pop().replace(/\.[^/.]+$/, '') : 'Untitled'))
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

  const filenameFallback = video.path
    ? video.path.split('/').pop().replace(/\.[^/.]+$/, '')
    : 'Untitled'

  const handleTitleSave = async () => {
    setEditingTitle(false)
    const trimmed = titleDraft.trim() || filenameFallback
    if (trimmed === title) return
    setTitle(trimmed)
    try {
      await VideoService.updateTitle(video.video_id, trimmed)
    } catch (err) {
      console.error('Failed to save title:', err)
      setTitle(title)
    }
  }

  const handleDetailsModalClose = (update) => {
    setDetailsModalOpen(false)
    if (update && update !== 'delete') {
      if (update.title !== undefined) setTitle(update.title || filenameFallback)
      if (update.description !== undefined) setDescription(update.description || '')
      if ('game' in update) setGame(update.game)
    }
  }

  return (
    <>
    <DeleteVideoModal
      open={deleteModalOpen}
      onClose={(result) => { setDeleteModalOpen(false); if (result === 'delete') onDelete?.(video.video_id) }}
      videoId={video.video_id}
      alertHandler={alertHandler}
    />
    <UpdateDetailsModal
      open={detailsModalOpen}
      close={handleDetailsModalClose}
      videoId={video.video_id}
      currentTitle={title}
      currentDescription={description}
      currentRecordedAt={video.recorded_at}
      currentGame={game}
      alertHandler={alertHandler}
    />
    <Box
      sx={{
        width: '100%',
        height: '100%',
        bgcolor: '#00000066',
        borderRadius: fullWidth ? 0 : '12px',
        overflow: 'hidden',
        outline: selected ? '2px solid #2684FF' : 'none',
        outlineOffset: '-2px',
      }}
    >
      {/* Thumbnail */}
      <Box sx={{ aspectRatio: '16 / 9', overflow: 'hidden', position: 'relative' }}>
      <motion.div
        style={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
        onClick={() => editMode ? onSelect?.(video.video_id) : openVideoHandler(video.video_id)}
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
            width: '100%',
            height: '100%',
            objectFit: 'cover',
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
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: 0,
              animationName: 'fadeIn',
              animationDuration: '1.5s',
              animationFillMode: 'both',
              WebkitAnimationName: 'fadeIn',
              WebkitAnimationDuration: '1.5s',
              WebkitAnimationFillMode: 'both',
            }}
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
            bgcolor: '#000000BF',
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
            bgcolor: '#000000BF',
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
                background: '#00000099',
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
                background: '#00000099',
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

      {/* Selection overlay */}
      {editMode && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 32,
            height: 32,
            borderRadius: '8px',
            bgcolor: selected ? '#1565C0CC' : '#00000055',
            border: '2px solid',
            borderColor: selected ? '#90CAF9' : 'rgba(255,255,255,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            pointerEvents: 'none',
          }}
        >
          {selected && <CheckIcon sx={{ fontSize: 20, color: 'white' }} />}
        </Box>
      )}

      {/* Game detection suggestion bar — overlaid on thumbnail bottom */}
      <AnimatePresence>
        {canTagGames && gameSuggestion && showSuggestion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.25,
                bgcolor: '#0b132b99',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                {suggestionIcon && (
                  <img
                    src={suggestionIcon}
                    alt=""
                    style={{ width: 30, height: 30, borderRadius: '4px', flexShrink: 0, objectFit: 'cover' }}
                  />
                )}
                <Typography
                  sx={{ fontSize: 15, color: '#FFFFFFD9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  Game Detected: <strong>{gameSuggestion.game_name}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleSuggestionAccept() }}
                  disabled={suggestionLoading}
                  sx={{ color: '#4caf50', bgcolor: '#4CAF501A', '&:hover': { bgcolor: '#4CAF5033' }, width: 34, height: 34 }}
                >
                  <CheckIcon sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleSuggestionReject() }}
                  disabled={suggestionLoading}
                  sx={{ color: '#f44336', bgcolor: '#F443361A', '&:hover': { bgcolor: '#F4433633' }, width: 34, height: 34 }}
                >
                  <CloseIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
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
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={handleTitleSave}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.target.blur()
                if (e.key === 'Escape') { setTitleDraft(title); setEditingTitle(false) }
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                background: '#FFFFFF1F',
                border: 'none',
                borderRadius: '4px',
                outline: 'none',
                color: 'white',
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1.3,
                padding: '2px 4px',
                boxSizing: 'border-box',
                fontFamily: 'inherit',
              }}
            />
          ) : (
            <Typography
              onDoubleClick={(e) => { e.stopPropagation(); setTitleDraft(title); setEditingTitle(true) }}
              sx={{
                fontWeight: 700,
                fontSize: 16,
                lineHeight: 1.3,
                color: 'white',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'text',
              }}
            >
              {title}
            </Typography>
          )}

          {/* Game name */}
          {gameName && (
            <Typography
              component={game?.steamgriddb_id ? 'a' : 'span'}
              href={game?.steamgriddb_id ? `#/games/${game.steamgriddb_id}` : undefined}
              onClick={game?.steamgriddb_id ? (e) => e.stopPropagation() : undefined}
              sx={{
                fontSize: 14,
                color: '#FFFFFFB3',
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
                color: '#FFFFFF80',
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
            color: menuOpen ? 'primary.main' : '#FFFFFF59',
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
              border: '1px solid #FFFFFF14',
              borderRadius: '10px',
              minWidth: 160,
              boxShadow: '0 8px 32px #00000099',
              mt: 0.5,
            },
          },
        }}
      >
        {[
          { label: 'Edit',       Icon: EditIcon,           color: '#FFFFFFE6', onClick: () => setDetailsModalOpen(true) },
          { label: 'Transcode',  Icon: SlowMotionVideoIcon, color: '#FFFFFFE6', onClick: () => ConfigService.startTranscodingVideo(video.video_id).catch((err) => alertHandler?.({ type: 'error', message: err.response?.data?.includes('not enabled') ? 'Transcoding is disabled. Add ENABLE_TRANSCODING=true to your Docker environment variables.' : 'Failed to start transcoding.', open: true })) },
          { label: 'Copy Link',  Icon: LinkIcon,           color: '#FFFFFFE6', onClick: () => { navigator.clipboard.writeText(`${PURL}${video.video_id}`); alertHandler?.({ type: 'info', message: 'Link copied to clipboard', open: true }) } },
          { label: 'Delete',     Icon: DeleteOutlineIcon,  color: '#EF5350',  danger: true, onClick: () => setDeleteModalOpen(true) },
        ].map(({ label, Icon, color, danger, onClick }) => (
          <MenuItem
            key={label}
            onClick={() => { onClick?.(); setMenuAnchorEl(null) }}
            sx={{
              gap: 1.5,
              py: 1.25,
              fontSize: 14,
              color,
              bgcolor: danger ? '#EF535012' : 'transparent',
              '&:hover': { bgcolor: danger ? '#EF535028' : '#FFFFFF12' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, color: danger ? '#EF5350' : 'white' }}><Icon fontSize="small" /></ListItemIcon>
            {label}
          </MenuItem>
        ))}
      </Menu>

    </Box>
    </>
  )
}

export default CompactBetaVideoCard
