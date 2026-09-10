import React from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import { Box, Typography, IconButton, useTheme, useMediaQuery } from '@mui/material'
import { CopyToClipboard } from 'react-copy-to-clipboard'
import VideocamIcon from '@mui/icons-material/Videocam'
import ImageIcon from '@mui/icons-material/Image'
import FolderIcon from '@mui/icons-material/Folder'
import LinkIcon from '@mui/icons-material/Link'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import { useNavigate } from 'react-router-dom'
import Select from 'react-select'
import { FolderService } from '../services'
import { getPosterUrl, getImageThumbnailUrl } from '../common/utils'
import { sortSelectTheme as selectSortTheme } from '../common/reactSelectThemes'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import { SORT_SELECT_WIDTH } from '../common/constants'

const FOLDER_SORT_OPTIONS = [
  { value: 'name_asc', label: 'Name A→Z' },
  { value: 'name_desc', label: 'Name Z→A' },
  { value: 'type', label: 'Type' },
]

// Toggle between the two folder thumbnail layouts: '2x2' (grid collage) or 'hero' (hero + side strip)
const FOLDER_THUMB_LAYOUT = 'hero'

const ThumbHeroStrip = ({ folder }) => {
  const items = folder.recent_items || []
  const getThumb = (id) => (folder.media_type === 'image' ? getImageThumbnailUrl(id) : getPosterUrl(id))

  if (items.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#001E3C',
        }}
      >
        <FolderIcon sx={{ fontSize: 48, color: '#FFFFFF33' }} />
      </Box>
    )
  }

  const cellSx = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: '#001E3C' }
  const stripItems = items.slice(1, 4)

  if (stripItems.length === 0) {
    return (
      <Box
        component="img"
        src={getThumb(items[0])}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        sx={cellSx}
      />
    )
  }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '2px',
      }}
    >
      <Box
        component="img"
        src={getThumb(items[0])}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        sx={cellSx}
      />
      <Box
        sx={{
          width: '64px',
          height: '100%',
          display: 'grid',
          gridTemplateRows: `repeat(${stripItems.length}, 1fr)`,
          gap: '2px',
        }}
      >
        {stripItems.map((id, i) => (
          <Box
            key={id || i}
            component="img"
            src={getThumb(id)}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
            sx={cellSx}
          />
        ))}
      </Box>
    </Box>
  )
}

const ThumbCollage = ({ folder }) => {
  const items = folder.recent_items || []
  const getThumb = (id) => (folder.media_type === 'image' ? getImageThumbnailUrl(id) : getPosterUrl(id))

  if (items.length === 0) {
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#001E3C',
        }}
      >
        <FolderIcon sx={{ fontSize: 48, color: '#FFFFFF33' }} />
      </Box>
    )
  }

  if (items.length === 1) {
    return (
      <Box
        component="img"
        src={getThumb(items[0])}
        onError={(e) => {
          e.currentTarget.style.display = 'none'
        }}
        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }

  // 2x2 grid (fewer cells fill remaining space by spanning)
  const cellSx = { width: '100%', height: '100%', objectFit: 'cover', display: 'block', bgcolor: '#001E3C' }

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: '2px',
      }}
    >
      {items.slice(0, 4).map((id, i) => (
        <Box
          key={id || i}
          component="img"
          src={getThumb(id)}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
          sx={cellSx}
        />
      ))}
    </Box>
  )
}

const Folders = ({ authenticated, searchText }) => {
  const [folders, setFolders] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState('')
  const [sortOrder, setSortOrder] = React.useState(FOLDER_SORT_OPTIONS[0])
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const [alert, setAlert] = React.useState({ open: false, type: 'info', message: '' })
  const navigate = useNavigate()
  const theme = useTheme()
  // eslint-disable-next-line no-unused-vars
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  React.useEffect(() => {
    FolderService.getFolders()
      .then((res) => {
        setFolders(res.data || [])
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching folders:', err)
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  const handleTogglePrivacy = (e, folder) => {
    e.stopPropagation()
    const newPrivate = !folder.private
    FolderService.updateFolderPrivacy(folder.uuid, newPrivate)
      .then(() => {
        setFolders((prev) => prev.map((f) => (f.uuid === folder.uuid ? { ...f, private: newPrivate } : f)))
        setAlert({
          type: 'info',
          message: newPrivate ? 'Folder set to private' : 'Folder set to public',
          open: true,
        })
      })
      .catch((err) => {
        console.error('Error updating folder privacy:', err)
        setAlert({ type: 'error', message: 'Could not update folder privacy', open: true })
      })
  }

  const effectiveSearch = searchText !== undefined ? searchText : search

  const filteredFolders = React.useMemo(() => {
    let result = folders
    if (effectiveSearch) {
      const re = new RegExp(effectiveSearch, 'i')
      result = result.filter((f) => (f.name || '').search(re) >= 0)
    }
    return [...result].sort((a, b) => {
      if (sortOrder.value === 'name_desc') {
        return (b.name || '').localeCompare(a.name || '', undefined, { sensitivity: 'base' })
      }
      if (sortOrder.value === 'type') {
        const cmp = (a.media_type || '').localeCompare(b.media_type || '')
        if (cmp !== 0) return cmp
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
      }
      return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    })
  }, [folders, effectiveSearch, sortOrder])

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
            <Box sx={{ minWidth: SORT_SELECT_WIDTH, flexShrink: 0 }}>
              <Select
                value={sortOrder}
                options={FOLDER_SORT_OPTIONS}
                onChange={setSortOrder}
                styles={selectSortTheme}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                blurInputOnSelect
                isSearchable={false}
              />
            </Box>
          </Box>,
          toolbarTarget,
        )}

      {filteredFolders.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            py: 8,
            gap: 2,
            border: '1px solid #FFFFFF14',
            borderRadius: '16px',
            background: '#00000040',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: 20, color: 'white' }}>No shared folders found</Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            justifyContent: 'center',
          }}
        >
          {filteredFolders.map((folder, index) => (
            <Box
              key={folder.uuid}
              sx={{
                width: { xs: 'calc(50% - 8px)', sm: '300px' },
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Box
                  onClick={() => navigate(`/folder/${folder.uuid}`)}
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '4 / 3',
                    borderRadius: 1,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    '&:hover': {
                      transform: 'scale(1.04)',
                      boxShadow: '0 8px 24px #00000080',
                    },
                  }}
                >
                  {FOLDER_THUMB_LAYOUT === 'hero' ? (
                    <ThumbHeroStrip folder={folder} />
                  ) : (
                    <ThumbCollage folder={folder} />
                  )}

                  {/* Privacy toggle button */}
                  {authenticated && (
                    <Box sx={{ position: 'absolute', top: 8, left: 8 }}>
                      <IconButton
                        sx={{
                          bgcolor: '#00000099',
                          '&:hover': { background: folder.private ? '#FF232360' : '#4CAF5060' },
                        }}
                        aria-label="toggle folder privacy"
                        size="small"
                        onClick={(e) => handleTogglePrivacy(e, folder)}
                      >
                        {folder.private ? (
                          <LockIcon sx={{ color: '#FF6B6B', fontSize: 18 }} />
                        ) : (
                          <LockOpenIcon sx={{ color: '#69F0AE', fontSize: 18 }} />
                        )}
                      </IconButton>
                    </Box>
                  )}

                  {/* Copy link button */}
                  <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                    <CopyToClipboard text={`${window.location.origin}/folder/${folder.uuid}`}>
                      <IconButton
                        sx={{
                          bgcolor: '#00000099',
                          '&:hover': { background: '#2684FF88' },
                        }}
                        aria-label="copy folder link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          setAlert({ type: 'info', message: 'Link copied to clipboard', open: true })
                        }}
                      >
                        <LinkIcon sx={{ color: 'white', fontSize: 18 }} />
                      </IconButton>
                    </CopyToClipboard>
                  </Box>

                  {/* Name + count overlay */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -1,
                      left: 0,
                      width: '100%',
                      display: 'inline-block',
                      p: 1,
                      pr: 3,
                      pt: 5,
                      background: `
                        linear-gradient(to top, #000000bb 55%, transparent)
                      `,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {folder.media_type === 'image' ? (
                        <ImageIcon sx={{ fontSize: 32, color: '#FFFFFFCC', flexShrink: 0 }} />
                      ) : (
                        <VideocamIcon sx={{ fontSize: 32, color: '#FFFFFFCC', flexShrink: 0 }} />
                      )}
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: 15,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {folder.name}
                        </Typography>
                        <Typography sx={{ color: '#FFFFFFAA', fontSize: 12 }}>
                          {folder.item_count} item{folder.item_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </motion.div>
            </Box>
          ))}
        </Box>
      )}

      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert((a) => ({ ...a, open }))}>
        {alert.message}
      </SnackbarAlert>
    </Box>
  )
}

export default Folders
