import * as React from 'react'
import { Modal, Box, Typography, Button, Stack, TextField, IconButton, Tooltip, Divider } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DownloadIcon from '@mui/icons-material/Download'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import { ImageService } from '../../services'
import { getPublicImageUrl, getImageUrl } from '../../common/utils'
import { labelSx, inputSx, dialogPaperSx } from '../../common/modalStyles'

const EditImageModal = ({ open, onClose, image, alertHandler, authenticated, onNext, onPrev }) => {
  const [title, setTitle] = React.useState('')
  const [privateView, setPrivateView] = React.useState(false)
  const saveTimerRef = React.useRef(null)
  const latestTitleRef = React.useRef('')

  const imageId = image?.image_id
  const shareUrl = `${getPublicImageUrl()}${imageId}`
  const fullImageUrl = getImageUrl(imageId)

  React.useEffect(() => {
    if (!open || !image) return
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

  const handleTitleChange = (e) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    latestTitleRef.current = newTitle
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null
      try {
        await ImageService.updateDetails(imageId, { title: latestTitleRef.current })
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
    onClose({ title: latestTitleRef.current, private: privateView })
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
    <Modal open={open} onClose={handleClose} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Box
        sx={{
          display: 'flex',
          maxWidth: '90vw',
          maxHeight: '90vh',
          outline: 'none',
        }}
      >
        {/* Image preview */}
        <Box
          sx={{
            flexShrink: 0,
            maxWidth: '60vw',
            maxHeight: '90vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '12px 0 0 12px',
            overflow: 'hidden',
            bgcolor: '#000',
          }}
        >
          <img
            src={fullImageUrl}
            alt={title}
            style={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              display: 'block',
            }}
          />
        </Box>

        {/* Side panel */}
        <Box
          sx={{
            width: 320,
            flexShrink: 0,
            alignSelf: 'stretch',
            p: 3,
            ...dialogPaperSx,
            borderRadius: '0 12px 12px 0',
            borderLeft: 'none',
            display: 'flex',
            flexDirection: 'column',
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
              Download
            </Button>
          </Stack>
        </Box>
      </Box>
    </Modal>
  )
}

export default EditImageModal
