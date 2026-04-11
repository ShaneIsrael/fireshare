import React from 'react'
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon, Skeleton } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import PhotoIcon from '@mui/icons-material/Photo'
import CheckIcon from '@mui/icons-material/Check'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicImageUrl, getImageThumbnailUrl } from '../../common/utils'
import { ImageService } from '../../services'
import DeleteImageModal from '../modal/DeleteImageModal'

const IMAGE_VERSION = Date.now()

const CompactImageCard = ({
  image,
  openImageHandler,
  alertHandler,
  authenticated,
  onRemoveFromView,
  editMode = false,
  selected = false,
  onSelect,
  showTypeIndicator = false,
}) => {
  const [thumbnailHover, setThumbnailHover] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(image.info?.private)
  const [title, setTitle] = React.useState(
    image.info?.title ||
      (image.path
        ? image.path
            .split('/')
            .pop()
            .replace(/\.[^/.]+$/, '')
        : 'Untitled'),
  )
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const [imgRetryKey, setImgRetryKey] = React.useState(0)
  const retryTimeoutRef = React.useRef(null)
  const retryCountRef = React.useRef(0)
  const MAX_RETRIES = 20

  React.useEffect(() => {
    setTitle(
      image.info?.title ||
        (image.path
          ? image.path
              .split('/')
              .pop()
              .replace(/\.[^/.]+$/, '')
          : 'Untitled'),
    )
  }, [image.info?.title, image.path])

  React.useEffect(() => {
    setPrivateView(image.info?.private)
  }, [image.info?.private])

  React.useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [])

  const [game, setGame] = React.useState(image.game || null)

  React.useEffect(() => {
    setGame(image.game || null)
  }, [image.game])

  const menuOpen = Boolean(menuAnchorEl)
  const PURL = getPublicImageUrl()
  const thumbnailUrl = getImageThumbnailUrl(image.image_id, IMAGE_VERSION)
  const viewCount = image.view_count || 0

  const handleImgError = React.useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) return
    retryCountRef.current += 1
    retryTimeoutRef.current = setTimeout(() => {
      setImgRetryKey((k) => k + 1)
    }, 4000)
  }, [])

  const handlePrivacyChange = async (e) => {
    e.stopPropagation()
    try {
      await ImageService.updatePrivacy(image.image_id, !privateView)
      alertHandler?.({
        type: privateView ? 'info' : 'warning',
        message: privateView ? 'Added to your public feed' : 'Removed from your public feed',
        open: true,
      })
      setPrivateView((v) => !v)
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to update privacy' })
    }
  }

  const handleDeleteClose = (result) => {
    setDeleteModalOpen(false)
    if (result === 'delete' && onRemoveFromView) {
      onRemoveFromView(image.image_id)
    }
  }

  return (
    <>
      <Box
        sx={{
          width: '100%',
          height: '100%',
          bgcolor: '#00000066',
          borderRadius: { xs: 0, sm: '12px' },
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Selected border overlay */}
        {selected && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              border: '2px solid #2684FF',
              borderRadius: { xs: 0, sm: '12px' },
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Thumbnail — fixed 16:9 with contain + black bars to match video card height */}
        <Box
          sx={{ aspectRatio: '16 / 9', overflow: 'hidden', position: 'relative', bgcolor: '#000', cursor: 'pointer' }}
          onClick={() => (editMode ? onSelect?.(image.image_id) : openImageHandler?.(image))}
          onMouseEnter={() => setThumbnailHover(true)}
          onMouseLeave={() => setThumbnailHover(false)}
        >
          <Skeleton
            variant="rectangular"
            animation="wave"
            width="100%"
            height="100%"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: imgLoaded ? 0 : 1,
              transition: 'opacity 0.8s ease',
              bgcolor: 'rgba(30, 60, 130, 0.4)',
            }}
          />
          <img
            key={imgRetryKey}
            src={thumbnailUrl}
            alt={title}
            onLoad={() => setImgLoaded(true)}
            onError={handleImgError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              opacity: imgLoaded ? 1 : 0,
              transition: 'opacity 0.8s ease',
            }}
          />

          {/* Views badge — bottom left, hides on hover to reveal privacy toggle */}
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14, color: 'white', fontFamily: 'monospace' }}>
                {viewCount}
              </Typography>
              <VisibilityIcon sx={{ fontSize: 18, color: 'white' }} />
            </Box>
          </Box>

          {/* Media type indicator — centered, fades out on hover */}
          {showTypeIndicator && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 2,
                opacity: thumbnailHover ? 0 : 1,
                transition: 'opacity 2s ease-in-out',
              }}
            >
              <PhotoIcon
                sx={{ fontSize: 40, color: 'rgba(255,255,255,0.75)', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.9))' }}
              />
            </Box>
          )}

          {/* Copy link button — top right, shows on hover */}
          <Box
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              opacity: thumbnailHover ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
            }}
          >
            <CopyToClipboard text={`${PURL}${image.image_id}`}>
              <IconButton
                sx={{ bgcolor: '#000000BF', '&:hover': { background: '#2684FF88' } }}
                aria-label="copy link"
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  alertHandler?.({ type: 'info', message: 'Link copied to clipboard', open: true })
                }}
              >
                <LinkIcon sx={{ color: 'white', fontSize: 24 }} />
              </IconButton>
            </CopyToClipboard>
          </Box>

          {/* Privacy toggle — bottom left, shows on hover when authenticated */}
          {authenticated && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                opacity: thumbnailHover ? 1 : 0,
                transition: 'opacity 0.2s ease-in-out',
              }}
            >
              <IconButton
                sx={{
                  bgcolor: '#000000BF',
                  '&:hover': { background: privateView ? '#FF232360' : '#2684FF88' },
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
        </Box>

        {/* Info section below thumbnail */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            flex: 1,
            mt: 1.5,
            px: 1.5,
            pb: 1.5,
            gap: 1.5,
          }}
        >
          {/* Game icon */}
          {game?.icon_url && (
            <a
              href={`#/games/${game.steamgriddb_id}`}
              onClick={(e) => e.stopPropagation()}
              style={{ flexShrink: 0, lineHeight: 0, alignSelf: 'flex-start' }}
            >
              <img
                src={game.icon_url}
                alt={game.name}
                onError={(e) => {
                  e.currentTarget.parentElement.style.display = 'none'
                }}
                style={{ width: 40, height: 40, objectFit: 'contain', display: 'block' }}
              />
            </a>
          )}

          {/* Text info */}
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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

            {game?.name && (
              <Typography
                component={game.steamgriddb_id ? 'a' : 'span'}
                href={game.steamgriddb_id ? `#/games/${game.steamgriddb_id}` : undefined}
                onClick={game.steamgriddb_id ? (e) => e.stopPropagation() : undefined}
                sx={{
                  fontSize: 14,
                  color: '#FFFFFFB3',
                  mt: 0.25,
                  display: 'block',
                  textDecoration: 'none',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  ...(game.steamgriddb_id && {
                    '&:hover': { color: '#3399FF', textDecoration: 'underline' },
                  }),
                }}
              >
                {game.name}
              </Typography>
            )}

            {image.created_at && (
              <Typography sx={{ fontSize: 14, color: '#FFFFFF80', mt: 'auto', pt: 0.5 }}>
                {new Date(image.created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </Typography>
            )}
          </Box>

          {/* 3-dot menu */}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation()
              setMenuAnchorEl(e.currentTarget)
            }}
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

        {/* Context menu */}
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
            {
              label: 'Copy Link',
              Icon: LinkIcon,
              color: '#FFFFFFE6',
              onClick: () => {
                navigator.clipboard.writeText(`${PURL}${image.image_id}`)
                alertHandler?.({ type: 'info', message: 'Link copied to clipboard', open: true })
              },
            },
            {
              label: 'Delete',
              Icon: DeleteOutlineIcon,
              color: '#EF5350',
              danger: true,
              requiresAuth: true,
              onClick: () => setDeleteModalOpen(true),
            },
          ]
            .filter((item) => !item.requiresAuth || authenticated)
            .map(({ label, Icon, color, danger, onClick }) => (
              <MenuItem
                key={label}
                onClick={() => {
                  onClick?.()
                  setMenuAnchorEl(null)
                }}
                sx={{
                  gap: 1.5,
                  py: 1.25,
                  fontSize: 14,
                  color,
                  bgcolor: danger ? '#EF535012' : 'transparent',
                  '&:hover': { bgcolor: danger ? '#EF535028' : '#FFFFFF12' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 0, color: danger ? '#EF5350' : 'white' }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                {label}
              </MenuItem>
            ))}
        </Menu>
      </Box>

      <DeleteImageModal
        open={deleteModalOpen}
        onClose={handleDeleteClose}
        imageId={image.image_id}
        alertHandler={alertHandler}
      />
    </>
  )
}

export default CompactImageCard
