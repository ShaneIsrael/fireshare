import React, { useCallback } from 'react'
import { motion } from 'framer-motion'
import { Box, Typography } from '@mui/material'
import SnackbarAlert from '../alert/SnackbarAlert'
import ImageIcon from '@mui/icons-material/Image'
import CompactImageCard from './CompactImageCard'

const PAGE_SIZE = 48

const ImageCards = ({ images, loadingIcon = null, feedView = false, authenticated, size, onImageOpen }) => {
  const [imgs, setImages] = React.useState(images || [])
  const [alert, setAlert] = React.useState({ open: false })
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE)
  const [isSingleColumn, setIsSingleColumn] = React.useState(false)
  const containerRef = React.useRef()
  const sentinelRef = React.useRef()

  React.useEffect(() => {
    setImages(images || [])
    setVisibleCount(PAGE_SIZE)
  }, [images])

  React.useEffect(() => {
    if (!imgs || imgs.length === 0) {
      setIsSingleColumn(false)
      return
    }

    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect?.width || 0
      if (!width) return
      const single = width < (size || 300) * 2 + 24
      setIsSingleColumn(single)
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

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, imgs.length))
        }
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [imgs.length])

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
                Upload screenshots or scan your image library
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
        <>
          <Box
            ref={containerRef}
            sx={{
              display: 'grid',
              width: isSingleColumn ? 'calc(100% + 48px)' : '100%',
              mx: isSingleColumn ? '-24px' : 0,
              gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${size || 300}px), 1fr))`,
              gap: '24px',
            }}
          >
            {imgs.slice(0, visibleCount).map((img, index) => (
              <motion.div
                key={img.image_id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index % PAGE_SIZE, 12) * 0.04 }}
              >
                <CompactImageCard
                  image={img}
                  openImageHandler={() => openImage(img)}
                  alertHandler={memoizedHandleAlert}
                  authenticated={authenticated}
                  onRemoveFromView={handleDelete}
                />
              </motion.div>
            ))}
          </Box>
          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
      )}
    </Box>
  )
}

export default ImageCards
