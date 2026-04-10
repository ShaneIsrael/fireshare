import React from 'react'
import ReactDOM from 'react-dom'
import { Box, Grid } from '@mui/material'
import Select from 'react-select'
import ImageCards from '../components/cards/ImageCards'
import EditImageModal from '../components/modal/EditImageModal'
import { ImageService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import selectSortTheme from '../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../common/constants'

const ImageFeed = ({ authenticated, searchText, cardSize }) => {
  const [images, setImages] = React.useState([])
  const [filteredImages, setFilteredImages] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [search, setSearch] = React.useState(searchText)
  const [alert, setAlert] = React.useState({ open: false })
  const [modalImage, setModalImage] = React.useState(null)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [toolbarTarget, setToolbarTarget] = React.useState(null)

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

  React.useEffect(() => {
    const fetchFn = authenticated ? ImageService.getImages : ImageService.getPublicImages
    fetchFn()
      .then((res) => {
        setImages(res.data.images)
        setFilteredImages(res.data.images)
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
  }, [authenticated])

  const sortedImages = React.useMemo(() => {
    if (!filteredImages) return []
    return [...filteredImages].sort((a, b) => {
      if (sortOrder.value === 'most_views') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (sortOrder.value === 'least_views') {
        return (a.view_count || 0) - (b.view_count || 0)
      } else {
        const dateA = a.updated_at ? new Date(a.updated_at) : new Date(0)
        const dateB = b.updated_at ? new Date(b.updated_at) : new Date(0)
        return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })
  }, [filteredImages, sortOrder])

  const handleImageOpen = (image) => {
    setModalImage(image)
  }

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
          <Box sx={{ minWidth: { xs: 120, sm: 150 } }}>
            <Select
              value={sortOrder}
              options={SORT_OPTIONS}
              onChange={setSortOrder}
              styles={selectSortTheme}
              menuPortalTarget={document.body}
              menuPosition="fixed"
              blurInputOnSelect
              isSearchable={false}
            />
          </Box>,
          toolbarTarget,
        )}
      <EditImageModal
        open={Boolean(modalImage)}
        onClose={handleModalClose}
        image={modalImage}
        alertHandler={setAlert}
        authenticated={authenticated}
      />
      <Box>
        <Grid container item justifyContent="center">
          <Grid item xs={12}>
            <Box>
              <Box>
                {loading && <LoadingSpinner />}
                {!loading && (
                  <ImageCards
                    images={sortedImages}
                    authenticated={authenticated}
                    feedView={true}
                    size={cardSize}
                    onImageOpen={handleImageOpen}
                  />
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
  )
}

export default ImageFeed
