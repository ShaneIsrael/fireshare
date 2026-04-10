import React, { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import ImageIcon from '@mui/icons-material/Image'
import CompactImageCard from './CompactImageCard'

// Stable per-image delay derived from image ID so it doesn't change across re-renders
function stableDelay(id) {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0
  }
  return (Math.abs(h) % 300) / 1000
}

// Each card is always in the DOM as a placeholder. When it scrolls near the
// viewport its full content mounts and fades in, keeping the masonry stable.
const LazyImageCard = ({
  img,
  openImageHandler,
  alertHandler,
  authenticated,
  onRemoveFromView,
  editMode,
  selected,
  onSelect,
}) => {
  const [activated, setActivated] = React.useState(false)
  const ref = React.useRef()

  React.useEffect(() => {
    const el = ref.current
    if (!el || activated) return

    const observerRef = { current: null }

    // Double-rAF ensures CSS columns layout has fully settled before we
    // measure positions — a single rAF fires before column reflow finishes.
    const rafId = requestAnimationFrame(() => {
      const rafId2 = requestAnimationFrame(() => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const inView = rect.top < window.innerHeight + 600 && rect.bottom > -600
        if (inView) {
          setActivated(true)
          return
        }
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setActivated(true)
              observerRef.current?.disconnect()
            }
          },
          { rootMargin: '600px' },
        )
        observerRef.current.observe(el)
      })
      rafIds.push(rafId2)
    })
    const rafIds = [rafId]

    return () => {
      rafIds.forEach(cancelAnimationFrame)
      observerRef.current?.disconnect()
    }
  }, [activated])

  const w = img.info?.width
  const h = img.info?.height
  const ratio = w && h ? `${w} / ${h}` : '16 / 9'

  return (
    <div
      ref={ref}
      style={{
        breakInside: 'avoid',
        marginBottom: 8,
        borderRadius: { xs: 0, sm: '8px' },
        width: '100%',
        aspectRatio: ratio,
        overflow: 'hidden',
        backgroundColor: activated ? 'transparent' : 'rgba(30, 60, 130, 0.12)',
      }}
    >
      {activated && (
        <motion.div
          initial={{ opacity: 0, filter: 'blur(12px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ duration: 0.5, delay: stableDelay(img.image_id) }}
          style={{ width: '100%', height: '100%' }}
        >
          <CompactImageCard
            image={img}
            openImageHandler={openImageHandler}
            alertHandler={alertHandler}
            authenticated={authenticated}
            onRemoveFromView={onRemoveFromView}
            editMode={editMode}
            selected={selected}
            onSelect={onSelect}
          />
        </motion.div>
      )}
    </div>
  )
}

const ImageCards = React.memo(({
  images,
  loadingIcon = null,
  feedView = false,
  authenticated,
  size,
  onImageOpen,
  editMode = false,
  selectedImages,
  onImageSelect,
}) => {
  const [imgs, setImages] = React.useState(images || [])
  const [alert, setAlert] = React.useState({ open: false })
  const [columnCount, setColumnCount] = React.useState(3)
  const containerRef = React.useRef()

  React.useEffect(() => {
    setImages(images || [])
  }, [images])

  React.useEffect(() => {
    if (!imgs || imgs.length === 0) {
      setColumnCount(3)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width || 0
      if (!width) return
      const colWidth = size || 300
      const cols = Math.max(1, Math.floor((width + 16) / (colWidth + 16)))
      setColumnCount(cols)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [size, imgs])

  const memoizedHandleAlert = useCallback((a) => setAlert(a), [])

  const handleDelete = (id) => {
    setImages((prev) => prev.filter((img) => img.image_id !== id))
  }

  const openImage = (img) => {
    if (onImageOpen) onImageOpen(img)
  }

  const EMPTY_STATE = () => (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: 8,
        px: 3,
        border: '1px solid #FFFFFF14',
        borderRadius: '16px',
        background: '#00000040',
      }}
    >
      {!loadingIcon && (
        <>
          <ImageIcon sx={{ fontSize: 56, color: '#FFFFFF33' }} />
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20, color: 'white', mb: 0.5 }}>No images found</Typography>
            {!feedView && (
              <Typography sx={{ fontSize: 14, color: '#FFFFFF66' }}>
                Upload images or scan your image library
              </Typography>
            )}
          </Box>
        </>
      )}
      {loadingIcon}
    </Box>
  )

  return (
    <Box>
      <SnackbarAlert
        severity={alert.type}
        open={alert.open}
        onClose={alert.onClose}
        setOpen={(open) => setAlert({ ...alert, open })}
      >
        {alert.message}
      </SnackbarAlert>

      {imgs.length === 0 && EMPTY_STATE()}
      {imgs.length > 0 && (
        <Box
          ref={containerRef}
          sx={{
            columnCount: columnCount,
            columnGap: '8px',
          }}
        >
          {imgs.map((img) => (
            <LazyImageCard
              key={img.image_id}
              img={img}
              openImageHandler={() => (editMode ? onImageSelect?.(img.image_id) : openImage(img))}
              alertHandler={memoizedHandleAlert}
              authenticated={authenticated}
              onRemoveFromView={handleDelete}
              editMode={editMode}
              selected={selectedImages?.has(img.image_id)}
              onSelect={onImageSelect}
            />
          ))}
        </Box>
      )}
    </Box>
  )
})

export default ImageCards
