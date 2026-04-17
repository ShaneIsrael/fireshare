import React from 'react'
import ReactDOM from 'react-dom'
import {
  Box,
  Grid,
  Button,
  ButtonGroup,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import DeleteIcon from '@mui/icons-material/Delete'
import CasinoIcon from '@mui/icons-material/Casino'
import Select from 'react-select'
import ImageCards from '../components/cards/ImageCards'
import EditImageModal from '../components/modal/EditImageModal'
import { ImageService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import selectSortTheme from '../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../common/constants'

const ImageFeed = ({ authenticated, searchText, cardSize, selectedImageFolder, onImageFoldersLoaded }) => {
  const [images, setImages] = React.useState([])
  const [filteredImages, setFilteredImages] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState(searchText)
  const [alert, setAlert] = React.useState({ open: false })
  const [modalImage, setModalImage] = React.useState(null)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [randomized, setRandomized] = React.useState(false)
  const [randomizedImages, setRandomizedImages] = React.useState([])
  const [toolbarTarget, setToolbarTarget] = React.useState(null)

  // Edit mode state
  const [editMode, setEditMode] = React.useState(false)
  const [selectedImages, setSelectedImages] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  if (searchText !== search) {
    setSearch(searchText)
    const tagMatches = (searchText || '').match(/#(\w+)/g) || []
    const tagNames = tagMatches.map((t) => t.slice(1).toLowerCase())
    const textQuery = (searchText || '').replace(/#\w+/g, '').trim()
    setFilteredImages(
      images.filter((img) => {
        const titleMatch =
          !textQuery ||
          img.info?.title?.search(new RegExp(textQuery, 'i')) >= 0 ||
          (img.game?.name && img.game.name.search(new RegExp(textQuery, 'i')) >= 0)
        const tagMatch = tagNames.every(
          (tagName) =>
            img.tags &&
            img.tags.some(
              (t) => t.name.toLowerCase() === tagName || t.name.replace(/_/g, ' ').toLowerCase() === tagName,
            ),
        )
        return titleMatch && tagMatch
      }),
    )
  }

  function fetchImages() {
    const fetchFn = authenticated ? ImageService.getImages : ImageService.getPublicImages
    fetchFn()
      .then((res) => {
        setImages(res.data.images)
        setFilteredImages(res.data.images)
        const tfolders = []
        res.data.images.forEach((img) => {
          const split = img.path
            .split('/')
            .slice(0, -1)
            .filter((f) => f !== '')
          if (split.length > 0 && !tfolders.includes(split[0])) {
            tfolders.push(split[0])
          }
        })
        tfolders.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)).unshift('All Images')
        if (onImageFoldersLoaded) onImageFoldersLoaded(tfolders)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        setAlert({
          open: true,
          type: 'error',
          message: typeof err.response?.data === 'string' ? err.response.data : 'Unknown Error',
        })
      })
  }

  React.useEffect(() => {
    fetchImages()
    // eslint-disable-next-line
  }, [authenticated])

  const folder = selectedImageFolder || { value: 'All Images', label: 'All Images' }

  const displayImages = React.useMemo(() => {
    if (folder.value === 'All Images') {
      return filteredImages
    }
    return filteredImages?.filter(
      (img) =>
        img.path
          .split('/')
          .slice(0, -1)
          .filter((f) => f !== '')[0] === folder.value,
    )
  }, [filteredImages, folder])

  const sortedImages = React.useMemo(() => {
    if (!displayImages) return []
    return [...displayImages].sort((a, b) => {
      if (sortOrder.value === 'most_views') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (sortOrder.value === 'least_views') {
        return (a.view_count || 0) - (b.view_count || 0)
      } else {
        const dateA = a.created_at ? new Date(a.created_at) : new Date(0)
        const dateB = b.created_at ? new Date(b.created_at) : new Date(0)
        return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })
  }, [displayImages, sortOrder])

  const finalImages = randomized ? randomizedImages : sortedImages

  const handleSortChange = (option) => {
    setSortOrder(option)
    setRandomized(false)
  }

  const handleRandomize = () => {
    const shuffled = [...displayImages].sort(() => Math.random() - 0.5)
    setRandomizedImages(shuffled)
    setRandomized(true)
  }

  const handleImageOpen = React.useCallback((image) => {
    setModalImage(image)
  }, [])

  // Edit mode handlers
  const handleEditModeToggle = () => {
    setEditMode(!editMode)
    if (editMode) setSelectedImages(new Set())
  }

  const handleImageSelect = React.useCallback((imageId) => {
    setSelectedImages((prev) => {
      const next = new Set(prev)
      if (next.has(imageId)) next.delete(imageId)
      else next.add(imageId)
      return next
    })
  }, [])

  const allSelected = finalImages.length > 0 && selectedImages.size === finalImages.length

  const handleSelectAllToggle = () => {
    if (allSelected) setSelectedImages(new Set())
    else setSelectedImages(new Set(finalImages.map((img) => img.image_id)))
  }

  const handleDeleteClick = () => setDeleteDialogOpen(true)
  const handleDeleteCancel = () => setDeleteDialogOpen(false)

  const handleDeleteConfirm = async () => {
    try {
      await Promise.all(Array.from(selectedImages).map((id) => ImageService.delete(id)))
      setAlert({
        open: true,
        type: 'success',
        message: `Deleted ${selectedImages.size} image${selectedImages.size > 1 ? 's' : ''}`,
      })
      fetchImages()
      setSelectedImages(new Set())
      setDeleteDialogOpen(false)
      setEditMode(false)
    } catch (err) {
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Error deleting images',
      })
    }
  }

  const handleNext = React.useCallback(() => {
    setModalImage((cur) => {
      if (!cur) return cur
      const idx = finalImages.findIndex((img) => img.image_id === cur.image_id)
      return idx >= 0 && idx < finalImages.length - 1 ? finalImages[idx + 1] : cur
    })
  }, [finalImages])

  const handlePrev = React.useCallback(() => {
    setModalImage((cur) => {
      if (!cur) return cur
      const idx = finalImages.findIndex((img) => img.image_id === cur.image_id)
      return idx > 0 ? finalImages[idx - 1] : cur
    })
  }, [finalImages])

  const handleModalClose = (update) => {
    if (update) {
      // Update the image in state with any changes from the modal
      const updateImage = (img) => {
        if (img.image_id !== modalImage.image_id) return img
        return {
          ...img,
          info: {
            ...img.info,
            ...(update.title !== undefined && { title: update.title }),
            ...(update.private !== undefined && { private: update.private }),
          },
          ...(update.game !== undefined && { game: update.game }),
        }
      }
      setImages((prev) => prev.map(updateImage))
      setFilteredImages((prev) => prev.map(updateImage))
    }
    setModalImage(null)
  }

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
            {!(editMode && isMdDown) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                <Box sx={{ minWidth: { xs: 120, sm: 150 } }}>
                  <Select
                    value={sortOrder}
                    options={SORT_OPTIONS}
                    onChange={handleSortChange}
                    styles={selectSortTheme}
                    menuPortalTarget={document.body}
                    menuPosition="fixed"
                    blurInputOnSelect
                    isSearchable={false}
                  />
                </Box>
                <IconButton
                  onClick={handleRandomize}
                  title="Randomize order"
                  sx={{
                    bgcolor: randomized ? 'primary.main' : '#001E3C',
                    borderRadius: '8px',
                    height: '38px',
                    width: '38px',
                    flexShrink: 0,
                    border: randomized ? 'none' : '1px solid #2684FF',
                    '&:hover': {
                      bgcolor: randomized ? 'primary.dark' : 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <CasinoIcon fontSize="small" />
                </IconButton>
              </Box>
            )}
            {authenticated && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
                {editMode && (
                  <ButtonGroup
                    variant="contained"
                    sx={{
                      height: 38,
                      flexShrink: 1,
                      minWidth: 0,
                      '& .MuiButton-root': {
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        px: { xs: 1, sm: 2 },
                      },
                    }}
                  >
                    <Button color="primary" onClick={handleSelectAllToggle}>
                      {allSelected ? 'Select None' : 'Select All'}
                    </Button>
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDeleteClick}
                      disabled={selectedImages.size === 0}
                    >
                      Delete{selectedImages.size > 0 && !isMdDown ? ` (${selectedImages.size})` : ''}
                    </Button>
                  </ButtonGroup>
                )}
                <IconButton
                  onClick={handleEditModeToggle}
                  sx={{
                    bgcolor: editMode ? 'primary.main' : '#001E3C',
                    borderRadius: '8px',
                    height: '38px',
                    flexShrink: 0,
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
      <EditImageModal
        open={Boolean(modalImage)}
        onClose={handleModalClose}
        image={modalImage}
        alertHandler={setAlert}
        authenticated={authenticated}
        onNext={handleNext}
        onPrev={handlePrev}
      />
      <Box>
        <Grid container item justifyContent="center">
          <Grid item xs={12}>
            <Box>
              <Box>
                {loading && <LoadingSpinner />}
                {!loading && (
                  <ImageCards
                    images={finalImages}
                    authenticated={authenticated}
                    feedView={!authenticated}
                    size={cardSize}
                    onImageOpen={handleImageOpen}
                    editMode={editMode}
                    selectedImages={selectedImages}
                    onImageSelect={handleImageSelect}
                  />
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>
          Delete {selectedImages.size} Image{selectedImages.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the selected image{selectedImages.size > 1 ? 's' : ''}? This will
            permanently delete the original file{selectedImages.size > 1 ? 's' : ''}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ImageFeed
