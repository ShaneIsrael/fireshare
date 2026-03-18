import React from 'react'
import ReactDOM from 'react-dom'
import {
  Box,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Autocomplete,
  TextField,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import Select from 'react-select'
import EditIcon from '@mui/icons-material/Edit'
import CheckIcon from '@mui/icons-material/Check'
import DeleteIcon from '@mui/icons-material/Delete'
import LinkIcon from '@mui/icons-material/Link'
import { GameService, VideoService } from '../services'
import VideoCards from '../components/cards/VideoCards'
import GameVideosHeader from '../components/game/GameVideosHeader'
import GameSearch from '../components/game/GameSearch'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import EditGameAssetsModal from '../components/modal/EditGameAssetsModal'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import { SORT_OPTIONS } from '../common/constants'
import selectSortTheme from '../common/reactSelectSortTheme'

const GameVideos = ({ cardSize, authenticated, searchText }) => {
  const { gameId } = useParams()
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  const [videos, setVideos] = React.useState([])
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [game, setGame] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const [alert, setAlert] = React.useState({ open: false })

  // Edit mode
  const [editMode, setEditMode] = React.useState(false)
  const [selectedVideos, setSelectedVideos] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [linkGameDialogOpen, setLinkGameDialogOpen] = React.useState(false)
  const [games, setGames] = React.useState([])
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [showAddNewGame, setShowAddNewGame] = React.useState(false)

  // Cover art editing
  const [editingAssets, setEditingAssets] = React.useState(false)
  const [cacheBust, setCacheBust] = React.useState(null)

  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info?.title?.search(new RegExp(searchText, 'i')) >= 0))
  }

  React.useEffect(() => {
    Promise.all([GameService.getGames(), GameService.getGameVideos(gameId)])
      .then(([gamesRes, videosRes]) => {
        const foundGame = gamesRes.data.find((g) => g.steamgriddb_id === parseInt(gameId))
        setGame(foundGame)
        const fetchedVideos = videosRes.data || []
        setVideos(fetchedVideos)
        setFilteredVideos(fetchedVideos)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching game videos:', err)
        setLoading(false)
      })
  }, [gameId])

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  React.useEffect(() => {
    const searchContainer = document.getElementById('navbar-search-container')
    if (searchContainer) {
      searchContainer.style.display = editMode && isMdDown ? 'none' : ''
    }
  }, [editMode, isMdDown])

  // ── Edit mode handlers ────────────────────────────────────────────────────

  const handleEditModeToggle = () => {
    setEditMode(!editMode)
    if (editMode) setSelectedVideos(new Set())
  }

  const allSelected = sortedVideos => sortedVideos.length > 0 && selectedVideos.size === sortedVideos.length

  const handleSelectAllToggle = (sortedVideos) => {
    if (allSelected(sortedVideos)) {
      setSelectedVideos(new Set())
    } else {
      setSelectedVideos(new Set(sortedVideos.map((v) => v.video_id)))
    }
  }

  const handleVideoSelect = (videoId) => {
    const next = new Set(selectedVideos)
    if (next.has(videoId)) next.delete(videoId)
    else next.add(videoId)
    setSelectedVideos(next)
  }

  const handleDeleteConfirm = async () => {
    try {
      await Promise.all(Array.from(selectedVideos).map((id) => VideoService.delete(id)))
      setAlert({ open: true, type: 'success', message: `Deleted ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''}` })
      const res = await GameService.getGameVideos(gameId)
      const fetched = res.data || []
      setVideos(fetched)
      setFilteredVideos(fetched)
      setSelectedVideos(new Set())
      setDeleteDialogOpen(false)
      setEditMode(false)
    } catch (err) {
      setAlert({ open: true, type: 'error', message: err.response?.data || 'Error deleting videos' })
    }
  }

  const handleLinkGameClick = async () => {
    try {
      const res = await GameService.getGames()
      setGames(res.data)
      setLinkGameDialogOpen(true)
      setShowAddNewGame(false)
      setSelectedGame(null)
    } catch (err) {
      setAlert({ open: true, type: 'error', message: err.response?.data || 'Error fetching games' })
    }
  }

  const handleLinkGameConfirm = async () => {
    if (!selectedGame) return
    try {
      await Promise.all(Array.from(selectedVideos).map((id) => GameService.linkVideoToGame(id, selectedGame.id)))
      setAlert({ open: true, type: 'success', message: `Linked ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} to ${selectedGame.name}` })
      setSelectedVideos(new Set())
      setLinkGameDialogOpen(false)
      setSelectedGame(null)
      setEditMode(false)
    } catch (err) {
      setAlert({ open: true, type: 'error', message: err.response?.data || 'Error linking videos' })
    }
  }

  const handleNewGameCreated = async (newGame) => {
    try {
      await Promise.all(Array.from(selectedVideos).map((id) => GameService.linkVideoToGame(id, newGame.id)))
      setAlert({ open: true, type: 'success', message: `Linked ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} to ${newGame.name}` })
      setSelectedVideos(new Set())
      setLinkGameDialogOpen(false)
      setShowAddNewGame(false)
      setEditMode(false)
    } catch (err) {
      setAlert({ open: true, type: 'error', message: err.response?.data || 'Error linking videos to new game' })
    }
  }

  // ── Cover art handlers ────────────────────────────────────────────────────

  const handleAssetSaved = () => {
    const bust = Date.now()
    setEditingAssets(false)
    setGame((prev) => {
      if (!prev) return prev
      const base = `/api/game/assets/${prev.steamgriddb_id}`
      return {
        ...prev,
        hero_url: `${base}/hero_1.png?v=${bust}`,
        logo_url: `${base}/logo_1.png?v=${bust}`,
        icon_url: `${base}/icon_1.png?v=${bust}`,
      }
    })
    setCacheBust(bust)
  }

  // ── Sorting ───────────────────────────────────────────────────────────────

  const sortedVideos = React.useMemo(() => {
    if (!filteredVideos || !Array.isArray(filteredVideos)) return []
    return [...filteredVideos].sort((a, b) => {
      if (sortOrder.value === 'most_views') return (b.view_count || 0) - (a.view_count || 0)
      if (sortOrder.value === 'least_views') return (a.view_count || 0) - (b.view_count || 0)
      const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
      const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
      return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
    })
  }, [filteredVideos, sortOrder])

  if (loading) return <LoadingSpinner />

  const isAllSelected = sortedVideos.length > 0 && selectedVideos.size === sortedVideos.length

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!(editMode && isMdDown) && (
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
              </Box>
            )}
            {authenticated && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {editMode && (
                  <ButtonGroup variant="contained" sx={{ height: 38, minWidth: 'fit-content' }}>
                    <Button color="primary" onClick={() => handleSelectAllToggle(sortedVideos)}>
                      {isAllSelected ? 'Select None' : 'Select All'}
                    </Button>
                    <Button
                      color="primary"
                      startIcon={<LinkIcon />}
                      onClick={handleLinkGameClick}
                      disabled={selectedVideos.size === 0}
                    >
                      Link to Game {selectedVideos.size > 0 && !isMdDown && `(${selectedVideos.size})`}
                    </Button>
                    <Button
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => setDeleteDialogOpen(true)}
                      disabled={selectedVideos.size === 0}
                    >
                      Delete {selectedVideos.size > 0 && !isMdDown && `(${selectedVideos.size})`}
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
                    '&:hover': { bgcolor: editMode ? 'primary.dark' : '#FFFFFF33' },
                  }}
                >
                  {editMode ? <CheckIcon /> : <EditIcon />}
                </IconButton>
              </Box>
            )}
          </Box>,
          toolbarTarget,
        )}

      <GameVideosHeader
        game={game}
        cacheBust={cacheBust}
        editMode={editMode}
        onEditAssets={() => setEditingAssets(true)}
      />
      <Box sx={{ p: 3 }}>
        <VideoCards
          videos={sortedVideos}
          authenticated={authenticated}
          size={cardSize}
          feedView={false}
          editMode={editMode}
          selectedVideos={selectedVideos}
          onVideoSelect={handleVideoSelect}
        />
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete {selectedVideos.size} Video{selectedVideos.size > 1 ? 's' : ''}?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the selected video{selectedVideos.size > 1 ? 's' : ''}? This will
            permanently delete the video file{selectedVideos.size > 1 ? 's' : ''}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Link to Game Dialog */}
      <Dialog open={linkGameDialogOpen} onClose={() => { setLinkGameDialogOpen(false); setSelectedGame(null) }} maxWidth="sm" fullWidth>
        <DialogTitle>Link {selectedVideos.size} Clip{selectedVideos.size !== 1 ? 's' : ''} to Game</DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {!showAddNewGame ? (
            <Autocomplete
              options={[...games, { id: 'add-new', name: 'Add a new game...', isAddNew: true }]}
              getOptionLabel={(option) => option.name || ''}
              value={selectedGame}
              onChange={(_, newValue) => {
                if (newValue?.isAddNew) { setShowAddNewGame(true); setSelectedGame(null) }
                else setSelectedGame(newValue)
              }}
              renderInput={(params) => <TextField {...params} placeholder="Select a game..." />}
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontStyle: option.isAddNew ? 'italic' : 'normal', color: option.isAddNew ? 'primary.main' : 'inherit' }}>
                  {option.icon_url && <img src={option.icon_url} alt={option.name} style={{ width: 32, height: 32, objectFit: 'contain' }} />}
                  <Typography>{option.name}</Typography>
                </Box>
              )}
            />
          ) : (
            <GameSearch
              onGameLinked={handleNewGameCreated}
              onError={(err) => setAlert({ open: true, type: 'error', message: err.response?.data || 'Error adding game' })}
              onWarning={(msg) => setAlert({ open: true, type: 'warning', message: msg })}
              placeholder="Search SteamGridDB..."
            />
          )}
        </DialogContent>
        <DialogActions>
          {showAddNewGame && <Button onClick={() => setShowAddNewGame(false)} sx={{ mr: 'auto' }}>Back to List</Button>}
          <Button onClick={() => { setLinkGameDialogOpen(false); setSelectedGame(null) }}>Cancel</Button>
          {!showAddNewGame && <Button onClick={handleLinkGameConfirm} variant="contained" disabled={!selectedGame}>Link</Button>}
        </DialogActions>
      </Dialog>

      {/* Cover Art Modal */}
      <EditGameAssetsModal
        game={game}
        open={editingAssets}
        onClose={() => setEditingAssets(false)}
        onSaved={handleAssetSaved}
      />
    </>
  )
}

export default GameVideos
