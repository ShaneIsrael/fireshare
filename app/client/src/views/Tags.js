import React from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
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
import { useNavigate } from 'react-router-dom'
import { TagService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'

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
              const color = tag.color || '#2684FF'

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={tag.id}>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.04 }}
                  >
                    <Box
                      onClick={() => handleTagClick(tag.id)}
                      sx={{
                        position: 'relative',
                        height: 100,
                        borderRadius: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid' : '3px solid transparent',
                        borderColor: isSelected ? 'primary.main' : 'transparent',
                        bgcolor: `${color}22`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 1,
                        py: 2,
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        '&:hover': {
                          transform: 'scale(1.03)',
                          boxShadow: `0 4px 20px ${color}44`,
                        },
                        boxShadow: `inset 0 0 0 1px ${color}55`,
                      }}
                    >
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
                            bgcolor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '4px',
                            '&.Mui-checked': { color: 'primary.main' },
                          }}
                        />
                      )}
                      <Typography sx={{ fontWeight: 700, fontSize: 16, color: 'white' }}>{tag.name}</Typography>
                      <Chip
                        label={`${tag.video_count ?? 0} video${tag.video_count !== 1 ? 's' : ''}`}
                        size="small"
                        sx={{ bgcolor: `${color}33`, color: 'white', fontSize: 12 }}
                      />
                    </Box>
                  </motion.div>
                </Grid>
              )
            })}
        </Grid>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete {selectedTags.size} Tag{selectedTags.size > 1 ? 's' : ''}?</DialogTitle>
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
          <Button onClick={() => { setDeleteDialogOpen(false); setDeleteAssociatedVideos(false) }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* New Tag Dialog */}
      <Dialog open={newTagDialogOpen} onClose={() => setNewTagDialogOpen(false)}>
        <DialogTitle>Create New Tag</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '20px !important', minWidth: 300 }}>
          <TextField
            autoFocus
            label="Tag Name"
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            fullWidth
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography sx={{ color: '#FFFFFFB3', fontSize: 14 }}>Color</Typography>
            <input
              type="color"
              value={newTagColor}
              onChange={(e) => setNewTagColor(e.target.value)}
              style={{ width: 48, height: 32, cursor: 'pointer', border: 'none', background: 'none' }}
            />
            <Chip label={newTagName || 'Preview'} sx={{ bgcolor: `${newTagColor}33`, color: 'white' }} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewTagDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateTag} variant="contained" disabled={!newTagName.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Tags
