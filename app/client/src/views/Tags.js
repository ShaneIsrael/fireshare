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
  Chip,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import AddIcon from '@mui/icons-material/Add'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import PaletteIcon from '@mui/icons-material/Palette'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useNavigate } from 'react-router-dom'
import { SketchPicker } from 'react-color'
import { TagService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'

const DEFAULT_TAG_COLOR = '#2684FF'

const Tags = ({ authenticated, searchText }) => {
  const [tags, setTags] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [selectedTags, setSelectedTags] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteAssociatedVideos, setDeleteAssociatedVideos] = React.useState(false)
  const [newTagDialogOpen, setNewTagDialogOpen] = React.useState(false)
  const [newTagName, setNewTagName] = React.useState('')
  const [newTagColor, setNewTagColor] = React.useState(DEFAULT_TAG_COLOR)
  const [colorPickerAnchorEl, setColorPickerAnchorEl] = React.useState(null)
  const [editingTag, setEditingTag] = React.useState(null)
  const [editTagColor, setEditTagColor] = React.useState(DEFAULT_TAG_COLOR)
  const [editColorPickerAnchorEl, setEditColorPickerAnchorEl] = React.useState(null)
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
      setNewTagColor(DEFAULT_TAG_COLOR)
      setColorPickerAnchorEl(null)
    } catch (err) {
      console.error('Error creating tag:', err)
    }
  }

  const handleOpenColorEdit = (e, tag) => {
    e.stopPropagation()
    setEditingTag(tag)
    setEditTagColor(tag.color || DEFAULT_TAG_COLOR)
  }

  const handleSaveTagColor = async () => {
    if (!editingTag) return
    try {
      await TagService.updateTag(editingTag.id, { color: editTagColor })
      loadTags()
      setEditingTag(null)
      setEditColorPickerAnchorEl(null)
    } catch (err) {
      console.error('Error updating tag color:', err)
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
                  <ButtonGroup variant="contained" sx={{ height: 38, minWidth: 'fit-content' }}>
                    <Button color="primary" onClick={handleSelectAllToggle}>
                      {allSelected ? 'Select None' : 'Select All'}
                    </Button>
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedTags.size === 0}
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
                    sx={{ height: 38 }}
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
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            mt: 10,
            gap: 2,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: '#FFFFFF08',
              border: '1px solid #FFFFFF12',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LocalOfferIcon sx={{ fontSize: 36, color: '#FFFFFF33' }} />
          </Box>
          <Typography sx={{ color: '#FFFFFF44', fontSize: 16, fontWeight: 500 }}>
            {searchText ? 'No tags match your search.' : 'No tags yet. Create one to get started.'}
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={1.5}>
          {[...filteredTags]
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
            .map((tag, index) => {
              const isSelected = selectedTags.has(tag.id)
              const color = tag.color || DEFAULT_TAG_COLOR

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={tag.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: index * 0.035 }}
                  >
                    <Box
                      onClick={() => handleTagClick(tag.id)}
                      sx={{
                        position: 'relative',
                        height: 80,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        pl: 2.5,
                        pr: 1.5,
                        // Left accent stripe via inset shadow
                        boxShadow: isSelected
                          ? `inset 5px 0 0 ${color}, 0 0 0 2px ${color}99`
                          : `inset 5px 0 0 ${color}`,
                        // Subtle gradient wash from tag color
                        background: `linear-gradient(100deg, ${color}22 0%, ${color}0D 35%, #0A1929 70%)`,
                        border: '1px solid',
                        borderColor: isSelected ? `${color}99` : 'rgba(255,255,255,0.06)',
                        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: isSelected
                            ? `inset 5px 0 0 ${color}, 0 0 0 2px ${color}99, 0 6px 24px ${color}30`
                            : `inset 5px 0 0 ${color}, 0 6px 24px ${color}28`,
                        },
                      }}
                    >
                      {/* Tag icon in accent color */}
                      <LocalOfferIcon
                        sx={{
                          color,
                          fontSize: 20,
                          flexShrink: 0,
                          filter: `drop-shadow(0 0 6px ${color}88)`,
                        }}
                      />

                      {/* Name + count */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                          noWrap
                          sx={{ fontWeight: 700, fontSize: 14, color: 'white', lineHeight: 1.3 }}
                        >
                          {tag.name.replace(/_/g, ' ')}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#FFFFFF55', mt: 0.2 }}>
                          {tag.video_count ?? 0} video{tag.video_count !== 1 ? 's' : ''}
                        </Typography>
                      </Box>

                      {/* Edit mode controls */}
                      {editMode && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                          {/* Color edit button */}
                          <IconButton
                            size="small"
                            onClick={(e) => handleOpenColorEdit(e, tag)}
                            sx={{
                              color: '#FFFFFF66',
                              '&:hover': { color: color, bgcolor: `${color}22` },
                            }}
                          >
                            <PaletteIcon fontSize="small" />
                          </IconButton>
                          {/* Checkbox */}
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation()
                              handleTagSelect(tag.id)
                            }}
                            sx={{
                              color: '#FFFFFF44',
                              '&.Mui-checked': { color },
                              p: 0.75,
                            }}
                          />
                        </Box>
                      )}

                      {/* Video count badge (non-edit mode, right side) */}
                      {!editMode && (
                        <Chip
                          label={tag.video_count ?? 0}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: 11,
                            bgcolor: `${color}22`,
                            color: color,
                            border: `1px solid ${color}44`,
                            fontWeight: 700,
                            flexShrink: 0,
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      )}
                    </Box>
                  </motion.div>
                </Grid>
              )
            })}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>
          Delete {selectedTags.size} Tag{selectedTags.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
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
          >
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Tag Color Dialog */}
      <Dialog open={!!editingTag} onClose={() => { setEditingTag(null); setEditColorPickerAnchorEl(null) }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PaletteIcon sx={{ color: editTagColor }} />
          Edit Tag Color
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important', minWidth: 300 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: '#FFFFFFB3', fontSize: 14, flex: 1 }}>
              {editingTag?.name?.replace(/_/g, ' ')}
            </Typography>
            <Box
              onClick={(e) => setEditColorPickerAnchorEl(e.currentTarget)}
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1,
                bgcolor: editTagColor,
                cursor: 'pointer',
                border: '2px solid rgba(255,255,255,0.3)',
                flexShrink: 0,
                boxShadow: `0 0 10px ${editTagColor}66`,
                transition: 'box-shadow 0.2s ease',
              }}
            />
            <Button
              size="small"
              startIcon={<RestartAltIcon />}
              onClick={() => setEditTagColor(DEFAULT_TAG_COLOR)}
              sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, flexShrink: 0 }}
            >
              Reset
            </Button>
          </Box>
          {/* Preview */}
          <Box
            sx={{
              height: 60,
              borderRadius: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              background: `linear-gradient(100deg, ${editTagColor}22 0%, ${editTagColor}0D 35%, #0A1929 70%)`,
              boxShadow: `inset 4px 0 0 ${editTagColor}`,
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <LocalOfferIcon sx={{ color: editTagColor, fontSize: 18, filter: `drop-shadow(0 0 6px ${editTagColor}88)` }} />
            <Typography sx={{ fontWeight: 700, fontSize: 13, color: 'white' }}>
              {editingTag?.name?.replace(/_/g, ' ')}
            </Typography>
          </Box>
          <Popover
            open={Boolean(editColorPickerAnchorEl)}
            anchorEl={editColorPickerAnchorEl}
            onClose={() => setEditColorPickerAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <SketchPicker
              color={editTagColor}
              onChangeComplete={(color) => setEditTagColor(color.hex)}
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
          <Button onClick={() => { setEditingTag(null); setEditColorPickerAnchorEl(null) }}>Cancel</Button>
          <Button onClick={handleSaveTagColor} variant="contained">Save</Button>
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
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important', minWidth: 300 }}>
          <TextField
            autoFocus
            label="Tag Name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            fullWidth
            inputProps={{ maxLength: 12 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: '#FFFFFFB3', fontSize: 14 }}>Color</Typography>
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
          >
            Cancel
          </Button>
          <Button onClick={handleCreateTag} variant="contained" disabled={!newTagName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Tags
