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
  Skeleton,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import ImageIcon from '@mui/icons-material/Image'
import { useNavigate } from 'react-router-dom'
import { GameService } from '../services'
import { dialogPaperSx, dialogTitleSx, helperTextSx, checkboxSx } from '../common/modalStyles'
import { recordAssetBust, applyAssetBusts } from '../services/GameService'
import { getGameAssetUrl } from '../common/utils'
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
  const [loadedHeroes, setLoadedHeroes] = React.useState(new Set())
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
        setGames(applyAssetBusts(res.data))
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
    const bust = Date.now()
    recordAssetBust(editedId)
    window.dispatchEvent(new CustomEvent('gameAssetsUpdated', { detail: { steamgriddbId: editedId, bust } }))
    setEditingGame(null)
    setGames((prev) =>
      prev.map((g) => {
        if (g.steamgriddb_id !== editedId) return g
        return {
          ...g,
          hero_url: getGameAssetUrl(g.steamgriddb_id, 'hero_1', bust),
          banner_url: getGameAssetUrl(g.steamgriddb_id, 'hero_2', bust),
          logo_url: getGameAssetUrl(g.steamgriddb_id, 'logo_1', bust),
          icon_url: getGameAssetUrl(g.steamgriddb_id, 'icon_1', bust),
        }
      }),
    )
  }

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      <>
        {toolbarTarget
          ? ReactDOM.createPortal(
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
                {authenticated ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', minWidth: 0 }}>
                    {editMode ? (
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
                          disabled={selectedGames.size === 0}
                        >
                          Delete{selectedGames.size > 0 && !isMdDown ? ` (${selectedGames.size})` : null}
                        </Button>
                      </ButtonGroup>
                    ) : null}
                    <IconButton
                      onClick={handleEditModeToggle}
                      sx={{
                        bgcolor: editMode ? 'primary.main' : '#001E3C',
                        borderRadius: '8px',
                        height: '38px',
                        flexShrink: 0,
                        border: !editMode ? '1px solid #2684FF' : 'none',
                        '&:hover': {
                          bgcolor: editMode ? 'primary.dark' : '#FFFFFF33',
                        },
                      }}
                    >
                      {editMode ? <CheckIcon /> : <EditIcon />}
                    </IconButton>
                  </Box>
                ) : null}
              </Box>,
              toolbarTarget,
            )
          : null}
      </>

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
                        boxShadow: '0 8px 24px #00000080',
                      },
                    }}
                  >
                    {/* Checkbox for edit mode */}
                    {editMode ? (
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
                          bgcolor: '#00000080',
                          borderRadius: '4px',
                          '&.Mui-checked': {
                            color: 'primary.main',
                          },
                        }}
                      />
                    ) : null}

                    {/* Edit assets button (edit mode only) */}
                    {editMode ? (
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
                          bgcolor: '#00000099',
                          color: 'white',
                          '&:hover': { bgcolor: '#000000D9' },
                        }}
                      >
                        <ImageIcon fontSize="small" />
                      </IconButton>
                    ) : null}

                    {game.hero_url && (
                      <>
                        <Skeleton
                          variant="rectangular"
                          animation="wave"
                          sx={{
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                            height: '100%',
                            opacity: loadedHeroes.has(game.id) ? 0 : 1,
                            transition: 'opacity 0.3s ease',
                          }}
                        />
                        <Box
                          component="img"
                          src={game.hero_url}
                          onLoad={() => setLoadedHeroes((prev) => new Set([...prev, game.id]))}
                          onError={(e) => {
                            e.currentTarget.style.display = 'none'
                          }}
                          sx={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            position: 'absolute',
                            filter: 'brightness(0.7)',
                            opacity: loadedHeroes.has(game.id) ? 1 : 0,
                            transition: 'opacity 0.3s ease',
                          }}
                        />
                      </>
                    )}
                    {game.logo_url && (
                      <Box
                        component="img"
                        src={game.logo_url}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none'
                        }}
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
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} PaperProps={{ sx: dialogPaperSx }}>
        <DialogTitle sx={{ ...dialogTitleSx, px: 3, pt: 2.5, pb: 0 }}>
          Delete {selectedGames.size} Game{selectedGames.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: '20px !important', pb: 1 }}>
          <Typography sx={{ ...helperTextSx, mb: 2 }}>
            Are you sure you want to delete the selected game{selectedGames.size > 1 ? 's' : ''}?
          </Typography>
          <FormControlLabel
            control={
              <Checkbox
                checked={deleteAssociatedVideos}
                onChange={(e) => setDeleteAssociatedVideos(e.target.checked)}
                sx={{ ...checkboxSx, '&.Mui-checked': { color: 'error.main' } }}
              />
            }
            label={<Typography sx={helperTextSx}>Also delete associated videos</Typography>}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button
            onClick={handleDeleteCancel}
            sx={{ color: '#FFFFFF80', '&:hover': { color: 'white', bgcolor: '#FFFFFF0F' } }}
          >
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" sx={{ fontWeight: 600, px: 3 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default Games
