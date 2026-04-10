import React from 'react'
import { Box, Typography, IconButton, Menu, MenuItem, ListItemIcon, Skeleton, Tooltip } from '@mui/material'
import LinkIcon from '@mui/icons-material/Link'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { getPublicImageUrl, getImageThumbnailUrl } from '../../common/utils'
import { ImageService } from '../../services'
import DeleteImageModal from '../modal/DeleteImageModal'
import CheckIcon from '@mui/icons-material/Check'
import TagChip from '../misc/TagChip'

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
}) => {
  const [hover, setHover] = React.useState(false)
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
  const [localTags, setLocalTags] = React.useState(image.tags || [])

  const menuOpen = Boolean(menuAnchorEl)
  const PURL = getPublicImageUrl()
  const thumbnailUrl = getImageThumbnailUrl(image.image_id, IMAGE_VERSION)

  const viewCount = image.view_count || 0

  // Thumbnail retry logic (image may not be processed yet)
  const handleImgError = React.useCallback(() => {
    if (retryCountRef.current >= MAX_RETRIES) return
    retryCountRef.current += 1
    retryTimeoutRef.current = setTimeout(() => {
      setImgRetryKey((k) => k + 1)
    }, 4000)
  }, [])

  React.useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
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

  const handleDelete = async () => {
    setMenuAnchorEl(null)
    setDeleteModalOpen(true)
  }

  const handleDeleteClose = (result) => {
    setDeleteModalOpen(false)
    if (result === 'delete' && onRemoveFromView) {
      onRemoveFromView(image.image_id)
    }
  }

  // Allow parent to update card state after modal edits
  const updateFromModal = (update) => {
    if (!update) return
    if (update.title !== undefined) setTitle(update.title)
    if (update.private !== undefined) setPrivateView(update.private)
  }

  return (
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
      {/* Thumbnail */}
      <Box sx={{ aspectRatio: '16 / 9', overflow: 'hidden', position: 'relative' }}>
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
        <Box
          sx={{ position: 'absolute', inset: 0, cursor: 'pointer' }}
          onClick={() => openImageHandler?.(image)}
          onMouseEnter={() => setThumbnailHover(true)}
          onMouseLeave={() => setThumbnailHover(false)}
        >
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

          {/* Views badge - bottom left, hides on hover */}
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

          {/* Copy link button - shows on hover */}
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
                sx={{
                  bgcolor: '#000000BF',
                  '&:hover': { background: '#2684FF88' },
                }}
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

          {/* Visibility toggle button - shows on hover when authenticated */}
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
        </Box>

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
        {image.game?.icon_url && (
          <Box sx={{ flexShrink: 0, lineHeight: 0, alignSelf: 'flex-start' }}>
            <img
              src={image.game.icon_url}
              alt={image.game.name}
              onError={(e) => {
                e.currentTarget.parentElement.style.display = 'none'
              }}
              style={{ width: 40, height: 40, objectFit: 'contain', display: 'block' }}
            />
          </Box>
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

          {image.game?.name && (
            <Typography
              sx={{
                fontSize: 14,
                color: '#FFFFFFB3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                mt: 0.25,
              }}
            >
              {image.game.name}
            </Typography>
          )}

          {/* Tag chips */}
          {localTags.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {localTags.map((tag) => (
                <TagChip key={tag.id} tag={tag} size="small" />
              ))}
            </Box>
          )}
        </Box>

        {/* 3-dot menu */}
        {authenticated && (
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
        )}
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
        <MenuItem
          onClick={() => {
            setMenuAnchorEl(null)
            handleDelete()
          }}
          sx={{ color: '#FF6B6B', '&:hover': { bgcolor: '#FF6B6B1A' } }}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" sx={{ color: '#FF6B6B' }} />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
      <DeleteImageModal
        open={deleteModalOpen}
        onClose={handleDeleteClose}
        imageId={image.image_id}
        alertHandler={alertHandler}
      />
    </Box>
  )
}

export default CompactImageCard
