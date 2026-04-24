import * as React from 'react'
import {
  Modal,
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { ImageService } from '../../services'
import { getPublicImageUrl, getImageUrl } from '../../common/utils'
import { labelSx, inputSx, dialogPaperSx } from '../../common/modalStyles'
import GameSearch from '../game/GameSearch'

const EditImageModal = ({ open, onClose, image, alertHandler, authenticated, onNext, onPrev }) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [title, setTitle] = React.useState('')
  const [privateView, setPrivateView] = React.useState(false)
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [imgLoaded, setImgLoaded] = React.useState(false)
  const [showSwipeHint, setShowSwipeHint] = React.useState(false)
  const [panningDisabled, setPanningDisabled] = React.useState(true)
  const wasOpenRef = React.useRef(false)
  const saveTimerRef = React.useRef(null)
  const latestTitleRef = React.useRef('')
  const transformRef = React.useRef(null)
  const prevZoomedRef = React.useRef(false)

  const imageId = image?.image_id
  const shareUrl = `${getPublicImageUrl()}${imageId}`
  const fullImageUrl = getImageUrl(imageId)

  React.useEffect(() => {
    if (!open || !image) {
      wasOpenRef.current = false
      setTitle('')
      setPrivateView(false)
      setSelectedGame(null)
      setImgLoaded(false)
      setShowSwipeHint(false)
      setPanningDisabled(true)
      latestTitleRef.current = ''
      return
    }
    const t =
      image.info?.title ||
      (image.path
        ? image.path
            .split('/')
            .pop()
            .replace(/\.[^/.]+$/, '')
        : 'Untitled')
    setTitle(t)
    latestTitleRef.current = t
    setPrivateView(image.info?.private || false)
    ImageService.addView(image.image_id).catch(() => {})
    ImageService.getGame(image.image_id)
      .then((res) => setSelectedGame(res.data?.game || null))
      .catch(() => setSelectedGame(null))

    if (!wasOpenRef.current) {
      wasOpenRef.current = true
      setImgLoaded(false)
      const preload = new window.Image()
      preload.onload = () => setImgLoaded(true)
      preload.onerror = () => setImgLoaded(true)
      preload.src = fullImageUrl
    }
  }, [open, image])

  // Flush any pending save on unmount / close
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [])

  // Arrow key navigation
  React.useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') onNext?.()
      if (e.key === 'ArrowLeft') onPrev?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onNext, onPrev])

  // Show swipe hint briefly when modal first opens
  React.useEffect(() => {
    if (!open || !isMobile) return
    setShowSwipeHint(true)
    const t = setTimeout(() => setShowSwipeHint(false), 3000)
    return () => clearTimeout(t)
  }, [open, isMobile])

  // Reset zoom + pan whenever the displayed image changes
  React.useEffect(() => {
    transformRef.current?.resetTransform()
    prevZoomedRef.current = false
    setPanningDisabled(true)
  }, [image?.image_id])

  // Swipe navigation — only fires when fully zoomed out and no multitouch occurred
  const touchStartRef = React.useRef(null)
  const wasMultitouchRef = React.useRef(false)
  const handleTouchStart = React.useCallback((e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      wasMultitouchRef.current = false
    } else {
      wasMultitouchRef.current = true
    }
  }, [])
  const handleTouchEnd = React.useCallback(
    (e) => {
      if (!touchStartRef.current) return
      // Don't navigate if zoomed in or if a second finger was involved at any point.
      const scale = transformRef.current?.state?.scale ?? 1
      if (scale > 1 || wasMultitouchRef.current) {
        touchStartRef.current = null
        return
      }
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      touchStartRef.current = null
      if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return
      setShowSwipeHint(false)
      if (dx < 0) onNext?.()
      else onPrev?.()
    },
    [onNext, onPrev],
  )

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    latestTitleRef.current = newTitle
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null
      try {
        await ImageService.updateDetails(imageId, { title: latestTitleRef.current })
        alertHandler?.({ open: true, type: 'success', message: 'Title updated.' })
      } catch (err) {
        alertHandler?.({ open: true, type: 'error', message: 'Failed to save title.' })
      }
    }, 1500)
  }

  const handleClose = () => {
    // Flush pending save immediately
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      ImageService.updateDetails(imageId, { title: latestTitleRef.current }).catch(() => {})
    }
    onClose({ title: latestTitleRef.current, private: privateView, game: selectedGame })
  }

  const handleGameLinked = async (game, warning) => {
    try {
      await ImageService.linkGame(imageId, game.id)
      setSelectedGame(game)
      alertHandler?.({
        open: true,
        type: warning ? 'warning' : 'success',
        message: warning ? `Linked to ${game.name}. ${warning}` : `Linked to ${game.name}`,
      })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to link game' })
    }
  }

  const handleUnlinkGame = async () => {
    try {
      await ImageService.unlinkGame(imageId)
      setSelectedGame(null)
      alertHandler?.({ open: true, type: 'info', message: 'Game link removed' })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to unlink game' })
    }
  }

  const handlePrivacyToggle = async () => {
    try {
      await ImageService.updatePrivacy(imageId, !privateView)
      setPrivateView((v) => !v)
      alertHandler?.({
        open: true,
        type: privateView ? 'info' : 'warning',
        message: privateView ? 'Added to your public feed' : 'Removed from your public feed',
      })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to update privacy.' })
    }
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = `/api/image/original?id=${imageId}`
    a.download = ''
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!image) return null

  return (
    <Modal
      open={open && imgLoaded}
      onClose={handleClose}
      sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          maxWidth: { xs: '100vw', sm: '90vw' },
          maxHeight: { xs: '100svh', sm: '90vh' },
          width: { xs: '100vw', sm: 'auto' },
          height: { xs: '100svh', sm: 'auto' },
          outline: 'none',
          bgcolor: { xs: '#000', sm: 'transparent' },
        }}
      >
        {/* Image preview */}
        <Box
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          sx={{
            flexShrink: { xs: 1, sm: 0 },
            flex: { xs: 1, sm: 'none' },
            minHeight: 0,
            maxWidth: { xs: '100%', sm: '60vw' },
            maxHeight: { xs: 'none', sm: '90vh' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: { xs: 0, sm: '12px 0 0 12px' },
            overflow: 'hidden',
            bgcolor: '#000',
            position: 'relative',
          }}
        >
          <TransformWrapper
            ref={transformRef}
            minScale={1}
            maxScale={5}
            centerOnInit
            limitToBounds
            doubleClick={{ mode: 'toggle' }}
            panning={{ disabled: panningDisabled, velocityDisabled: true }}
            onTransform={(ref) => {
              const zoomed = ref.state.scale > 1
              if (zoomed !== prevZoomedRef.current) {
                prevZoomedRef.current = zoomed
                setPanningDisabled(!zoomed)
              }
            }}
          >
            <TransformComponent
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={fullImageUrl}
                alt={title}
                onLoad={() => setImgLoaded(true)}
                style={{
                  maxWidth: '100%',
                  maxHeight: isMobile ? '100%' : '90vh',
                  objectFit: 'contain',
                  display: 'block',
                  userSelect: 'none',
                }}
              />
            </TransformComponent>
          </TransformWrapper>

          {/* Swipe hint — bouncing chevrons, mobile only */}
          {showSwipeHint && isMobile && (
            <>
              <Box
                sx={{
                  position: 'absolute',
                  left: 12,
                  top: '50%',
                  pointerEvents: 'none',
                  zIndex: 10,
                  animation: 'bounceLeft 1s ease-in-out infinite',
                  '@keyframes bounceLeft': {
                    '0%, 100%': { transform: 'translateY(-50%) translateX(0)' },
                    '50%': { transform: 'translateY(-50%) translateX(-8px)' },
                  },
                }}
              >
                <ChevronLeftIcon
                  sx={{ color: 'white', fontSize: 44, opacity: 0.75, filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}
                />
              </Box>
              <Box
                sx={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  pointerEvents: 'none',
                  zIndex: 10,
                  animation: 'bounceRight 1s ease-in-out infinite',
                  '@keyframes bounceRight': {
                    '0%, 100%': { transform: 'translateY(-50%) translateX(0)' },
                    '50%': { transform: 'translateY(-50%) translateX(8px)' },
                  },
                }}
              >
                <ChevronRightIcon
                  sx={{ color: 'white', fontSize: 44, opacity: 0.75, filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.8))' }}
                />
              </Box>
            </>
          )}
        </Box>

        {/* Side panel */}
        <Box
          sx={{
            width: { xs: '100%', sm: 320 },
            flexShrink: 0,
            alignSelf: 'stretch',
            p: { xs: 2, sm: 3 },
            ...dialogPaperSx,
            borderRadius: { xs: 0, sm: '0 12px 12px 0' },
            borderLeft: { xs: 'none', sm: 'none' },
            borderTop: { xs: '1px solid #FFFFFF26', sm: 'none' },
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
            overflowY: { xs: 'auto', sm: 'visible' },
          }}
        >
          {/* Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 2,
            }}
          >
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: 12,
                color: '#FFFFFF66',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}
            >
              Viewing
            </Typography>
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{
                color: '#FFFFFF80',
                bgcolor: '#FFFFFF14',
                borderRadius: '8px',
                '&:hover': { bgcolor: '#FFFFFF2A', color: 'white' },
                width: 30,
                height: 30,
              }}
            >
              <CloseIcon sx={{ fontSize: 17 }} />
            </IconButton>
          </Box>

          <Divider sx={{ borderColor: '#FFFFFF14', mb: 2, mx: -3 }} />

          <Stack spacing={2.5} sx={{ flex: 1 }}>
            {/* Title */}
            <Box>
              {authenticated ? (
                <>
                  <Typography sx={labelSx}>Title</Typography>
                  <TextField value={title ?? ''} onChange={handleTitleChange} fullWidth size="small" sx={inputSx} />
                </>
              ) : (
                <Typography
                  sx={{
                    fontWeight: 900,
                    fontSize: 21,
                    color: 'white',
                    lineHeight: 1.3,
                    letterSpacing: '-0.03em',
                    overflowX: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title || 'Untitled'}
                </Typography>
              )}
            </Box>

            {/* Privacy */}
            {authenticated && (
              <Box>
                <Typography sx={labelSx}>Visibility</Typography>
                <Box
                  onClick={handlePrivacyToggle}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    bgcolor: '#FFFFFF0D',
                    border: '1px solid #FFFFFF26',
                    borderRadius: '8px',
                    px: 1.5,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { borderColor: '#FFFFFF55' },
                  }}
                >
                  {privateView ? (
                    <VisibilityOffIcon sx={{ color: '#FF6B6B', fontSize: 20 }} />
                  ) : (
                    <VisibilityIcon sx={{ color: '#4caf50', fontSize: 20 }} />
                  )}
                  <Typography sx={{ color: 'white', fontSize: 14, flex: 1 }}>
                    {privateView ? 'Private' : 'Public'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Game */}
            {authenticated && (
              <Box>
                <Typography sx={labelSx}>Game</Typography>
                {selectedGame ? (
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      bgcolor: '#FFFFFF0D',
                      border: '1px solid #FFFFFF26',
                      borderRadius: '8px',
                      px: 1.5,
                      py: 1,
                    }}
                  >
                    {selectedGame.icon_url && (
                      <img
                        src={selectedGame.icon_url}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
                        style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                      />
                    )}
                    <Typography
                      sx={{
                        fontSize: 14,
                        color: 'white',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedGame.name}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={handleUnlinkGame}
                      sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.25 }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      bgcolor: '#FFFFFF0D',
                      border: '1px solid #FFFFFF26',
                      borderRadius: '8px',
                      py: 0,
                      overflow: 'hidden',
                      '& .MuiInputBase-root': { color: 'white', px: 0.5 },
                      '& input::placeholder': { color: '#FFFFFF66', opacity: 1 },
                      '& .MuiSvgIcon-root': { color: '#FFFFFF66' },
                    }}
                  >
                    <GameSearch
                      onGameLinked={handleGameLinked}
                      onError={(err) =>
                        alertHandler?.({
                          open: true,
                          type: 'error',
                          message: err.response?.data || 'Error linking game',
                        })
                      }
                      placeholder="Search for a game..."
                    />
                  </Box>
                )}
              </Box>
            )}

            {/* Share link */}
            <Box>
              <Typography sx={labelSx}>Share Link</Typography>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  bgcolor: '#FFFFFF0D',
                  border: '1px solid #FFFFFF26',
                  borderRadius: '8px',
                  px: 1.5,
                  py: 0.75,
                }}
              >
                <Typography noWrap sx={{ color: '#FFFFFFB3', fontSize: 13, flex: 1, fontFamily: 'monospace' }}>
                  {shareUrl}
                </Typography>
                <CopyToClipboard
                  text={shareUrl}
                  onCopy={() => alertHandler?.({ open: true, type: 'success', message: 'Link copied!' })}
                >
                  <Tooltip title="Copy link">
                    <IconButton size="small" sx={{ color: '#FFFFFF99' }}>
                      <ContentCopyIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </CopyToClipboard>
              </Box>
            </Box>

            {/* Download */}
            <Button
              fullWidth
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownload}
              sx={{
                color: 'white',
                borderColor: '#FFFFFF26',
                '&:hover': { borderColor: '#FFFFFF55', bgcolor: '#FFFFFF12' },
              }}
            >
              Download HD
            </Button>
          </Stack>
        </Box>
      </Box>
    </Modal>
  )
}

export default EditImageModal
