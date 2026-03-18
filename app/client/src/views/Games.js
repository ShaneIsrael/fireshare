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
  useTheme,
  useMediaQuery,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import ImageIcon from '@mui/icons-material/Image'
import { useNavigate } from 'react-router-dom'
import { GameService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import EditGameAssetsModal from '../components/modal/EditGameAssetsModal'

const Games = ({ authenticated, searchText }) => {
  const [games, setGames] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [selectedGames, setSelectedGames] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteAssociatedVideos, setDeleteAssociatedVideos] = React.useState(false)
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const [editingGame, setEditingGame] = React.useState(null)
  const navigate = useNavigate()
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  // Filter games based on search text
  const filteredGames = React.useMemo(() => {
    if (!searchText) return games
    return games.filter((game) => (game.name || '').toLowerCase().includes(searchText.toLowerCase()))
  }, [games, searchText])

  React.useEffect(() => {
    GameService.getGames()
      .then((res) => {
        setGames(res.data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching games:', err)
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  // Hide search bar when in edit mode on md and smaller
  React.useEffect(() => {
    const searchContainer = document.getElementById('navbar-search-container')
    if (searchContainer) {
      searchContainer.style.display = editMode && isMdDown ? 'none' : ''
    }
  }, [editMode, isMdDown])


  const handleEditModeToggle = () => {
    setEditMode(!editMode)
    if (editMode) {
      setSelectedGames(new Set())
    }
  }

  const allSelected = filteredGames.length > 0 && selectedGames.size === filteredGames.length

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelectedGames(new Set())
    } else {
      setSelectedGames(new Set(filteredGames.map((g) => g.steamgriddb_id)))
    }
  }

  const handleGameSelect = (gameId) => {
    const newSelected = new Set(selectedGames)
    if (newSelected.has(gameId)) {
      newSelected.delete(gameId)
    } else {
      newSelected.add(gameId)
    }
    setSelectedGames(newSelected)
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      const deletePromises = Array.from(selectedGames).map((gameId) =>
        GameService.deleteGame(gameId, deleteAssociatedVideos),
      )
      await Promise.all(deletePromises)

      // Refresh games list
      const res = await GameService.getGames()
      setGames(res.data)

      // Reset state
      setSelectedGames(new Set())
      setDeleteDialogOpen(false)
      setDeleteAssociatedVideos(false)
      setEditMode(false)
    } catch (err) {
      console.error('Error deleting games:', err)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setDeleteAssociatedVideos(false)
  }

  const handleGameClick = (gameId) => {
    if (editMode) {
      handleGameSelect(gameId)
    } else {
      navigate(`/games/${gameId}`)
    }
  }

  const handleAssetSaved = () => {
    const editedId = editingGame?.steamgriddb_id
    setEditingGame(null)
    GameService.getGames()
      .then((res) => {
        const bust = `?v=${Date.now()}`
        setGames(
          res.data.map((g) => {
            if (g.steamgriddb_id !== editedId) return g
            return {
              ...g,
              hero_url: g.hero_url ? g.hero_url + bust : g.hero_url,
              logo_url: g.logo_url ? g.logo_url + bust : g.logo_url,
              icon_url: g.icon_url ? g.icon_url + bust : g.icon_url,
            }
          }),
        )
      })
      .catch((err) => console.error('Error refreshing games:', err))
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
                  <ButtonGroup
                    variant="contained"
                    sx={{
                      height: 38,
                      minWidth: 'fit-content',
                    }}
                  >
                    <Button color="primary" onClick={handleSelectAllToggle}>
                      {allSelected ? 'Select None' : 'Select All'}
                    </Button>
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={handleDeleteClick}
                      disabled={selectedGames.size === 0}
                    >
                      Delete {selectedGames.size > 0 && !isMdDown && `(${selectedGames.size})`}
                    </Button>
                  </ButtonGroup>
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

      <Grid container spacing={2}>
        {[...filteredGames]
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
          .map((game, index) => {
            const isSelected = selectedGames.has(game.steamgriddb_id)

            return (
              <Grid item xs={12} sm={6} md={4} key={game.id}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                <Box
                  onClick={() => handleGameClick(game.steamgriddb_id)}
                  sx={{
                    position: 'relative',
                    height: 170,
                    borderRadius: 2,
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease',
                    border: isSelected ? '3px solid' : '3px solid transparent',
                    borderColor: isSelected ? 'primary.main' : 'transparent',
                    '&:hover': {
                      transform: 'scale(1.04)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    },
                  }}
                >
                  {/* Checkbox for edit mode */}
                  {editMode && (
                    <Checkbox
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation()
                        handleGameSelect(game.steamgriddb_id)
                      }}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 2,
                        color: 'white',
                        bgcolor: 'rgba(0, 0, 0, 0.5)',
                        borderRadius: '4px',
                        '&.Mui-checked': {
                          color: 'primary.main',
                        },
                      }}
                    />
                  )}

                  {/* Edit assets button (edit mode only) */}
                  {editMode && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingGame(game)
                      }}
                      sx={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        zIndex: 2,
                        bgcolor: 'rgba(0, 0, 0, 0.6)',
                        color: 'white',
                        '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
                      }}
                    >
                      <ImageIcon fontSize="small" />
                    </IconButton>
                  )}

                  {game.hero_url && (
                    <Box
                      component="img"
                      src={game.hero_url}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        position: 'absolute',
                        filter: 'brightness(0.7)',
                      }}
                    />
                  )}
                  {game.logo_url && (
                    <Box
                      component="img"
                      src={game.logo_url}
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                      sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        maxWidth: '65%',
                        maxHeight: '65%',
                        objectFit: 'contain',
                        zIndex: 1,
                      }}
                    />
                  )}
                </Box>
                </motion.div>
              </Grid>
            )
          })}
      </Grid>

      {/* Edit Game Assets Modal */}
      <EditGameAssetsModal
        game={editingGame}
        open={!!editingGame}
        onClose={() => setEditingGame(null)}
        onSaved={handleAssetSaved}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>
          Delete {selectedGames.size} Game{selectedGames.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete the selected game{selectedGames.size > 1 ? 's' : ''}?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteAssociatedVideos}
                onChange={(e) => setDeleteAssociatedVideos(e.target.checked)}
                sx={{
                  color: 'error.main',
                  '&.Mui-checked': {
                    color: 'error.main',
                  },
                }}
              />
            }
            label="Also delete associated videos"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Games
