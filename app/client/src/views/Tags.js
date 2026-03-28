import React from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import TagChip from '../components/misc/TagChip'
import {
  Box,
  Grid,
  Typography,
  IconButton,
  Checkbox,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Popover,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import AddIcon from '@mui/icons-material/Add'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import { useNavigate } from 'react-router-dom'
import { SketchPicker } from 'react-color'
import { TagService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'

const labelSx = { fontSize: 12, color: '#FFFFFFB3', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em' }

const hexToHsl = (hex) => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0, l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
      default: break
    }
  }
  return [h * 360, s * 100, l * 100]
}

const hslToHex = (h, s, l) => {
  h /= 360; s /= 100; l /= 100
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return `#${Math.round(r * 255).toString(16).padStart(2, '0')}${Math.round(g * 255).toString(16).padStart(2, '0')}${Math.round(b * 255).toString(16).padStart(2, '0')}`
}

const normalizeTagColor = (hex) => {
  if (!hex || hex.length < 7) return hex
  const [h, s, l] = hexToHsl(hex)
  return hslToHex(h, Math.min(s, 65), Math.max(30, Math.min(55, l)))
}

const darkenColor = (hex, factor = 0.3) => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    bgcolor: '#FFFFFF0D',
    borderRadius: '8px',
    '& fieldset': { borderColor: '#FFFFFF26' },
    '&:hover fieldset': { borderColor: '#FFFFFF55' },
    '&.Mui-focused fieldset': { borderColor: '#3399FF' },
  },
}

const Tags = ({ authenticated, searchText }) => {
  const [tags, setTags] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteAssociatedVideos, setDeleteAssociatedVideos] = React.useState(false)
  const [newTagDialogOpen, setNewTagDialogOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [newTagColor, setNewTagColor] = React.useState('#2684FF')
  const [colorPickerAnchorEl, setColorPickerAnchorEl] = React.useState(null)
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  const filteredTags = React.useMemo(() => {
    if (!searchText) return tags
    return tags.filter((t) => (t.name || '').toLowerCase().includes(searchText.toLowerCase()))
  }, [tags, searchText])

  const loadTags = React.useCallback(() => {
    TagService.getTags()
      .then((res) => {
        setTags(res.data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching tags:', err)
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    loadTags()
  }, [loadTags])

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  React.useEffect(() => {
    const searchContainer = document.getElementById('navbar-search-container')
    if (searchContainer) {
      searchContainer.style.display = editMode && isMdDown ? 'none' : ''
    }
  }, [editMode, isMdDown])

  const handleEditModeToggle = () => {
    setEditMode(!editMode)
    if (editMode) setSelectedTags(new Set())
  }

  const allSelected = filteredTags.length > 0 && selectedTags.size === filteredTags.length

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelectedTags(new Set())
    } else {
      setSelectedTags(new Set(filteredTags.map((t) => t.id)))
    }
  }

  const handleTagSelect = (tagId) => {
    const newSelected = new Set(selectedTags)
    if (newSelected.has(tagId)) {
      newSelected.delete(tagId)
    } else {
      newSelected.add(tagId)
    }
    setSelectedTags(newSelected)
  }

  const handleDeleteConfirm = async () => {
    try {
      await Promise.all(Array.from(selectedTags).map((tagId) => TagService.deleteTag(tagId, deleteAssociatedVideos)))
      loadTags()
      setSelectedTags(new Set())
      setDeleteDialogOpen(false)
      setDeleteAssociatedVideos(false)
      setEditMode(false)
    } catch (err) {
      console.error('Error deleting tags:', err)
    }
  }

  const handleTagClick = (tagId) => {
    if (editMode) {
      handleTagSelect(tagId)
    } else {
      navigate(`/tags/${tagId}`)
    }
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    try {
      await TagService.createTag({ name: newTagName.trim(), color: newTagColor })
      loadTags()
      setNewTagDialogOpen(false)
      setNewTagName('')
      setNewTagColor('#2684FF')
      setColorPickerAnchorEl(null)
    } catch (err) {
      console.error('Error creating tag:', err)
    }
  }

  if (loading) return <LoadingSpinner />

  return (
    <Box sx={{ p: 3 }}>
      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {authenticated && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editMode && (
                  <ButtonGroup variant="contained" sx={{ height: 38, minWidth: 'fit-content', borderRadius: '8px' }}>
                    <Button color="primary" onClick={handleSelectAllToggle} sx={{ borderRadius: '8px 0 0 8px' }}>
                      {allSelected ? 'Select None' : 'Select All'}
                    </Button>
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedTags.size === 0}
                      sx={{ borderRadius: '0 8px 8px 0' }}
                    >
                      Delete {selectedTags.size > 0 && !isMdDown && `(${selectedTags.size})`}
                    </Button>
                  </ButtonGroup>
                )}
                {!editMode && (
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setNewTagDialogOpen(true)}
                    sx={{ height: 38, borderRadius: '8px', bgcolor: '#3399FF', '&:hover': { bgcolor: '#1976D2' } }}
                  >
                    New Tag
                  </Button>
                )}
                <IconButton
                  onClick={handleEditModeToggle}
                  sx={{
                    bgcolor: editMode ? 'primary.main' : '#001E3C',
                    borderRadius: '8px',
                    height: '38px',
                    border: !editMode ? '1px solid #2684FF' : 'none',
                    '&:hover': {
                      bgcolor: editMode ? 'primary.dark' : 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  {editMode ? <CheckIcon /> : <EditIcon />}
                </IconButton>
              </Box>
            )}
          </Box>,
          toolbarTarget,
        )}

      {filteredTags.length === 0 ? (
        <Box sx={{ textAlign: 'center', mt: 8 }}>
          <LocalOfferIcon sx={{ fontSize: 64, color: '#FFFFFF22', mb: 2 }} />
          <Typography sx={{ color: '#FFFFFF55', fontSize: 18 }}>
            {searchText ? 'No tags match your search.' : 'No tags yet. Create one to get started.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {[...filteredTags]
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
            .map((tag, index) => {
              const isSelected = selectedTags.has(tag.id)
              const color = normalizeTagColor(tag.color || '#2684FF')

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} xl={2} key={tag.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                  >
                    <Box
                      onClick={() => handleTagClick(tag.id)}
                      sx={{
                        position: 'relative',
                        height: 140,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid' : '2px solid',
                        borderColor: darkenColor(color),
                        ...(!tag.preview_video_id && { bgcolor: `${color}44` }),
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.25,
                        py: 2,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                          transform: 'scale(1.03)',
                          boxShadow: `inset 0 0 0 1px ${darkenColor(color)}, 0 8px 32px #00000088, 0 4px 20px ${color}44`,
                        },
                        boxShadow: `inset 0 0 0 1px ${darkenColor(color)}, 0 4px 16px #00000066`,
                      }}
                    >
                      {tag.preview_video_id && (
                        <>
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              backgroundImage: `url(/api/video/poster?id=${tag.preview_video_id})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              filter: 'saturate(0.25)',
                              zIndex: 0,
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              bgcolor: color,
                              mixBlendMode: 'multiply',
                              zIndex: 0,
                            }}
                          />
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              bgcolor: '#00000077',
                              zIndex: 0,
                            }}
                          />
                        </>
                      )}
                      {editMode && (
                        <Checkbox
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            handleTagSelect(tag.id)
                          }}
                          sx={{
                            position: 'absolute',
                            top: 8,
                            left: 8,
                            zIndex: 2,
                            color: 'white',
                            bgcolor: '#00000080',
                            borderRadius: '4px',
                            '&.Mui-checked': { color: 'primary.main' },
                          }}
                        />
                      )}
                      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.25, px: 2, width: '100%' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: tag.name.length <= 5 ? 48 : tag.name.length <= 8 ? 38 : 28, color: 'white', textAlign: 'center', lineHeight: 1.2, fontFamily: '"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', width: '100%' }}>
                          {tag.name.replace(/_/g, ' ')}
                        </Typography>
                        <Typography sx={{ fontSize: 13, color: '#FFFFFFB3', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {tag.video_count ?? 0} video{tag.video_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>
                    </Box>
                  </motion.div>
                </Grid>
              )
            })}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle sx={{ fontWeight: 800, color: 'white' }}>
          Delete {selectedTags.size} Tag{selectedTags.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 14, color: '#FFFFFFB3' }}>
            Are you sure you want to delete the selected tag{selectedTags.size > 1 ? 's' : ''}?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteAssociatedVideos}
                onChange={(e) => setDeleteAssociatedVideos(e.target.checked)}
                sx={{ color: 'error.main', '&.Mui-checked': { color: 'error.main' } }}
              />
            }
            label="Also delete associated videos"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setDeleteDialogOpen(false)
              setDeleteAssociatedVideos(false)
            }}
            sx={{ borderRadius: '8px', color: 'white', borderColor: 'white' }}
          >
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" sx={{ borderRadius: '8px' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* New Tag Dialog */}
      <Dialog
        open={newTagDialogOpen}
        onClose={() => {
          setNewTagDialogOpen(false)
          setColorPickerAnchorEl(null)
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: 'white' }}>Create New Tag</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important', minWidth: 300 }}>
          <Box>
            <Typography sx={labelSx}>Tag Name</Typography>
            <TextField
              autoFocus
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
              fullWidth
              sx={inputSx}
              inputProps={{ maxLength: 12 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={labelSx}>Color</Typography>
            <Box
              onClick={(e) => setColorPickerAnchorEl(e.currentTarget)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: newTagColor,
                cursor: 'pointer',
                border: '2px solid rgba(255,255,255,0.3)',
              }}
            />
            <TagChip name={newTagName || 'Preview'} color={newTagColor} />
          </Box>
          <Popover
            open={Boolean(colorPickerAnchorEl)}
            anchorEl={colorPickerAnchorEl}
            onClose={() => setColorPickerAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <SketchPicker
              color={newTagColor}
              onChangeComplete={(color) => setNewTagColor(color.hex)}
              styles={{
                default: {
                  picker: { background: '#1e1e2e', boxShadow: '0 4px 20px rgba(0,0,0,0.5)' },
                  label: { color: '#FFFFFFB3' },
                  hash: { color: '#FFFFFFB3', background: '#2a2a3e' },
                  input: { color: '#fff', background: '#2a2a3e', border: '1px solid #444', boxShadow: 'none' },
                },
              }}
            />
          </Popover>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setNewTagDialogOpen(false)
              setColorPickerAnchorEl(null)
            }}
            sx={{ borderRadius: '8px', color: 'white', borderColor: 'white' }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateTag}
            variant="contained"
            disabled={!newTagName.trim()}
            sx={{ borderRadius: '8px', bgcolor: '#3399FF', '&:hover': { bgcolor: '#1976D2' } }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Tags
