import React from 'react'
import { createPortal } from 'react-dom'
import { Box, Typography } from '@mui/material'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import { useLocation } from 'react-router-dom'
import { AuthService } from '../../services'
import { getSetting } from '../../common/utils'

const DISABLED_PATHS = ['/login']

export const DragDropDisabledContext = React.createContext(null)
export const RegisterUploadCardContext = React.createContext(null)
export const RegisterImageUploadCardContext = React.createContext(null)

export const DisableDragDrop = ({ children }) => {
  const setDisabled = React.useContext(DragDropDisabledContext)
  React.useEffect(() => {
    setDisabled?.(true)
    return () => setDisabled?.(false)
  }, [setDisabled])
  return children ?? null
}

export default function GlobalDragDropOverlay({ children }) {
  const [dragActive, setDragActive] = React.useState(false)
  const [disabled, setDisabled] = React.useState(false)
  const [authenticated, setAuthenticated] = React.useState(false)
  const [uiConfig, setUiConfig] = React.useState(() => getSetting('ui_config'))
  const registeredCardRef = React.useRef(null)
  const registeredImageCardRef = React.useRef(null)
  const dragCounter = React.useRef(0)
  const activeRef = React.useRef(false)
  const location = useLocation()

  React.useEffect(() => {
    AuthService.isLoggedIn()
      .then((res) => setAuthenticated(res.data?.authenticated ?? !!res.data))
      .catch(() => setAuthenticated(false))
    setUiConfig(getSetting('ui_config'))
  }, [location.pathname])

  const canUpload = authenticated ? !!uiConfig?.show_admin_upload : !!uiConfig?.allow_public_upload
  const isPathDisabled = DISABLED_PATHS.includes(location.pathname)
  const active = canUpload && !disabled && !isPathDisabled

  React.useEffect(() => {
    activeRef.current = active
  }, [active])

  React.useEffect(() => {
    const onDragEnter = (e) => {
      if (!activeRef.current) return
      if (!e.dataTransfer?.types?.includes('Files')) return
      dragCounter.current++
      setDragActive(true)
    }

    const onDragLeave = () => {
      dragCounter.current = Math.max(0, dragCounter.current - 1)
      if (dragCounter.current === 0) setDragActive(false)
    }

    const onDragOver = (e) => {
      e.preventDefault()
    }

    const onDrop = (e) => {
      e.preventDefault()
      dragCounter.current = 0
      setDragActive(false)
      if (!activeRef.current) return
      const files = Array.from(e.dataTransfer?.files || [])
      if (files.length === 0) return
      const imageFiles = files.filter((f) => f.type.startsWith('image/'))
      const videoFiles = files.filter((f) => f.type.startsWith('video/'))
      if (imageFiles.length > 0 && registeredImageCardRef.current) {
        registeredImageCardRef.current.openFiles(imageFiles)
      } else if (videoFiles.length > 0 && registeredCardRef.current) {
        registeredCardRef.current.openFile(videoFiles[0])
      } else if (files.length > 0 && registeredCardRef.current) {
        registeredCardRef.current.openFile(files[0])
      }
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <DragDropDisabledContext.Provider value={setDisabled}>
      <RegisterUploadCardContext.Provider value={registeredCardRef}>
        <RegisterImageUploadCardContext.Provider value={registeredImageCardRef}>
          {children}
          {dragActive &&
            active &&
            createPortal(
              <Box
                sx={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 9999,
                  bgcolor: 'rgba(0, 0, 0, 0.75)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    border: '2px dashed #2684FF',
                    borderRadius: 4,
                    px: 8,
                    py: 6,
                    bgcolor: 'rgba(38, 132, 255, 0.08)',
                  }}
                >
                  <CloudUploadIcon sx={{ fontSize: 72, color: '#fff', mb: 2 }} />
                  <Typography variant="h5" sx={{ color: 'white', fontWeight: 700 }}>
                    Drop to Upload
                  </Typography>
                  <Typography sx={{ color: '#FFFFFF99', mt: 1 }}>Release to start uploading</Typography>
                </Box>
              </Box>,
              document.body,
            )}
        </RegisterImageUploadCardContext.Provider>
      </RegisterUploadCardContext.Provider>
    </DragDropDisabledContext.Provider>
  )
}
