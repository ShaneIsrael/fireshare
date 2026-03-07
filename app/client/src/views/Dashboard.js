import React from 'react'
import ReactDOM from 'react-dom'
import {
  Box,
  Grid,
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
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import CheckIcon from '@mui/icons-material/Check'
import LinkIcon from '@mui/icons-material/Link'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import GameSearch from '../components/game/GameSearch'
import { VideoService, GameService, ReleaseService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSetting, setSetting } from '../common/utils'
import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'

import selectFolderTheme from '../common/reactSelectFolderTheme'
import selectSortTheme from '../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../common/constants'

const createSelectFolders = (folders) => {
  return folders.map((f) => ({ value: f, label: f }))
}

const Dashboard = ({
  authenticated,
  searchText,
  cardSize,
  listStyle,
  showReleaseNotes,
  releaseNotes: releaseNotesProp,
}) => {
  const [videos, setVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [selectedFolder, setSelectedFolder] = React.useState(
    getSetting('folder') || { value: 'All Videos', label: 'All Videos' },
  )
  const [dateSortOrder, setDateSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })

  const [alert, setAlert] = React.useState({ open: false })

  const [prevCardSize, setPrevCardSize] = React.useState(cardSize)
  const [prevListStyle, setPrevListStyle] = React.useState(listStyle)

  // Edit mode state
  const [editMode, setEditMode] = React.useState(false)
  const [selectedVideos, setSelectedVideos] = React.useState(new Set())
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [linkGameDialogOpen, setLinkGameDialogOpen] = React.useState(false)
  const [games, setGames] = React.useState([])
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [showAddNewGame, setShowAddNewGame] = React.useState(false)
  const [featureAlertOpen, setFeatureAlertOpen] = React.useState(showReleaseNotes)
  const releaseNotes = releaseNotesProp
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const theme = useTheme()
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'))

  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info.title.search(new RegExp(searchText, 'i')) >= 0))
  }
  if (cardSize !== prevCardSize) {
    setPrevCardSize(cardSize)
  }
  if (listStyle !== prevListStyle) {
    setPrevListStyle(listStyle)
  }

  function fetchVideos() {
    VideoService.getVideos()
      .then((res) => {
        setVideos(res.data.videos)
        setFilteredVideos(res.data.videos)
        const tfolders = []
        res.data.videos.forEach((v) => {
          const split = v.path
            .split('/')
            .slice(0, -1)
            .filter((f) => f !== '')
          if (split.length > 0 && !tfolders.includes(split[0])) {
            tfolders.push(split[0])
          }
        })
        tfolders.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)).unshift('All Videos')
        setFolders(tfolders)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        setAlert({
          open: true,
          type: 'error',
          message: typeof err.response?.data === 'string' ? err.response.data : 'Unknown Error',
        })
        console.log(err)
      })
  }

  React.useEffect(() => {
    fetchVideos()
    // eslint-disable-next-line
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

  const handleFeatureAlertClose = () => {
    if (releaseNotes?.version && authenticated) {
      ReleaseService.setLastSeenVersion(releaseNotes.version).catch(() => {})
    }
    setFeatureAlertOpen(false)
  }

  const handleFolderSelection = (folder) => {
    setSetting('folder', folder)
    setSelectedFolder(folder)
  }


  // Get the filtered videos based on folder selection
  const displayVideos = React.useMemo(() => {
    if (selectedFolder.value === 'All Videos') {
      return filteredVideos
    }
    return filteredVideos?.filter(
      (v) =>
        v.path
          .split('/')
          .slice(0, -1)
          .filter((f) => f !== '')[0] === selectedFolder.value,
    )
  }, [filteredVideos, selectedFolder])

  // Sort videos by recorded date or views
  const sortedVideos = React.useMemo(() => {
    if (!displayVideos) return []

    return [...displayVideos].sort((a, b) => {
      if (dateSortOrder.value === 'most_views') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (dateSortOrder.value === 'least_views') {
        return (a.view_count || 0) - (b.view_count || 0)
      } else {
        const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
        const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
        return dateSortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })
  }, [displayVideos, dateSortOrder])

  const handleEditModeToggle = () => {
    setEditMode(!editMode)
    if (editMode) {
      setSelectedVideos(new Set())
    }
  }

  const allSelected = sortedVideos.length > 0 && selectedVideos.size === sortedVideos.length

  const handleSelectAllToggle = () => {
    if (allSelected) {
      setSelectedVideos(new Set())
    } else {
      setSelectedVideos(new Set(sortedVideos.map((v) => v.video_id)))
    }
  }

  const handleVideoSelect = (videoId) => {
    const newSelected = new Set(selectedVideos)
    if (newSelected.has(videoId)) {
      newSelected.delete(videoId)
    } else {
      newSelected.add(videoId)
    }
    setSelectedVideos(newSelected)
  }

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      const deletePromises = Array.from(selectedVideos).map((videoId) => VideoService.delete(videoId))
      await Promise.all(deletePromises)

      setAlert({
        open: true,
        type: 'success',
        message: `Successfully deleted ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''}`,
      })

      // Refresh videos list
      fetchVideos()

      // Reset state
      setSelectedVideos(new Set())
      setDeleteDialogOpen(false)
      setEditMode(false)
    } catch (err) {
      console.error('Error deleting videos:', err)
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Error deleting videos',
      })
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
  }

  const handleLinkGameClick = async () => {
    // Fetch games when opening dialog
    try {
      const res = await GameService.getGames()
      setGames(res.data)
      setLinkGameDialogOpen(true)
      setShowAddNewGame(false)
      setSelectedGame(null)
    } catch (err) {
      console.error('Error fetching games:', err)
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Error fetching games',
      })
    }
  }

  const handleNewGameCreated = async (game) => {
    // Link all selected videos to the newly created game
    try {
      const linkPromises = Array.from(selectedVideos).map((videoId) => GameService.linkVideoToGame(videoId, game.id))
      await Promise.all(linkPromises)

      setAlert({
        open: true,
        type: 'success',
        message: `Successfully linked ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} to ${game.name}`,
      })

      // Reset state
      setSelectedVideos(new Set())
      setLinkGameDialogOpen(false)
      setShowAddNewGame(false)
      setEditMode(false)
    } catch (err) {
      console.error('Error linking videos to game:', err)
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Error linking videos to new game',
      })
    }
  }

  const handleLinkGameConfirm = async () => {
    if (!selectedGame) return

    try {
      const linkPromises = Array.from(selectedVideos).map((videoId) =>
        GameService.linkVideoToGame(videoId, selectedGame.id),
      )
      await Promise.all(linkPromises)

      setAlert({
        open: true,
        type: 'success',
        message: `Successfully linked ${selectedVideos.size} video${selectedVideos.size > 1 ? 's' : ''} to ${selectedGame.name}`,
      })

      // Reset state
      setSelectedVideos(new Set())
      setLinkGameDialogOpen(false)
      setSelectedGame(null)
      setEditMode(false)
    } catch (err) {
      console.error('Error linking videos to game:', err)
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Error linking videos to game',
      })
    }
  }

  const handleLinkGameCancel = () => {
    setLinkGameDialogOpen(false)
    setSelectedGame(null)
  }

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {!(editMode && isMdDown) && (
              <Box sx={{ minWidth: 150 }}>
                <Select
                  value={dateSortOrder}
                  options={SORT_OPTIONS}
                  onChange={setDateSortOrder}
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
                      onClick={handleDeleteClick}
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
      <Box>
        <Grid container item justifyContent="center">
          <Grid item xs={12}>
            <Grid container justifyContent="center">
              <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 2 }}>
                <Select
                  value={selectedFolder}
                  options={createSelectFolders(folders)}
                  onChange={handleFolderSelection}
                  styles={selectFolderTheme}
                  blurInputOnSelect
                  isSearchable={false}
                />
              </Grid>
            </Grid>
            <Box>
              {listStyle === 'list' && (
                <VideoList
                  authenticated={authenticated}
                  loadingIcon={loading ? <LoadingSpinner /> : null}
                  videos={displayVideos}
                />
              )}
              {listStyle === 'card' && (
                <Box>
                  {!loading && (
                    <VideoCards
                      videos={sortedVideos}
                      authenticated={authenticated}
                      size={cardSize}
                      editMode={editMode}
                      selectedVideos={selectedVideos}
                      onVideoSelect={handleVideoSelect}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel}>
        <DialogTitle>
          Delete {selectedVideos.size} Video{selectedVideos.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the selected video{selectedVideos.size > 1 ? 's' : ''}? This will
            permanently delete the video file{selectedVideos.size > 1 ? 's' : ''}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link to Game Dialog */}
      <Dialog open={linkGameDialogOpen} onClose={handleLinkGameCancel} maxWidth="sm" fullWidth>
        <DialogTitle>
          Link {selectedVideos.size} Clip{selectedVideos.size !== 1 ? 's' : ''} to Game
        </DialogTitle>
        <DialogContent sx={{ pt: 3 }}>
          {!showAddNewGame ? (
            <>
              <Autocomplete
                options={[...games, { id: 'add-new', name: 'Add a new game...', isAddNew: true }]}
                getOptionLabel={(option) => option.name || ''}
                value={selectedGame}
                onChange={(_, newValue) => {
                  if (newValue?.isAddNew) {
                    setShowAddNewGame(true)
                    setSelectedGame(null)
                  } else {
                    setSelectedGame(newValue)
                  }
                }}
                renderInput={(params) => <TextField {...params} placeholder="Select a game..." />}
                renderOption={(props, option) => (
                  <Box
                    component="li"
                    {...props}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      fontStyle: option.isAddNew ? 'italic' : 'normal',
                      color: option.isAddNew ? 'primary.main' : 'inherit',
                    }}
                  >
                    {option.icon_url && (
                      <img
                        src={option.icon_url}
                        alt={option.name}
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                      />
                    )}
                    <Typography>{option.name}</Typography>
                  </Box>
                )}
              />
            </>
          ) : (
            <>
              <GameSearch
                onGameLinked={handleNewGameCreated}
                onError={(err) =>
                  setAlert({
                    open: true,
                    type: 'error',
                    message: err.response?.data || 'Error adding game',
                  })
                }
                placeholder="Search SteamGridDB..."
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          {showAddNewGame && (
            <Button onClick={() => setShowAddNewGame(false)} sx={{ mr: 'auto' }}>
              Back to List
            </Button>
          )}
          <Button onClick={handleLinkGameCancel}>Cancel</Button>
          {!showAddNewGame && (
            <Button onClick={handleLinkGameConfirm} variant="contained" disabled={!selectedGame}>
              Link
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Release Notes Dialog */}
      <Dialog open={featureAlertOpen} onClose={handleFeatureAlertClose} maxWidth="sm" scroll="paper">
        <DialogTitle sx={{ fontSize: 18, fontWeight: 'bold', color: 'primary.main', textTransform: 'uppercase' }}>{`New Update Available - v${releaseNotes?.version}`}</DialogTitle>
        <DialogContent sx={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <Box
            sx={{
              '& p': { my: 1 },
              '& strong': { fontWeight: 600 },
              '& a': { color: 'primary.main' },
              '& ul, & ol': { pl: 2, my: 1 },
              '& li': { mb: 0.5 },
            }}
            dangerouslySetInnerHTML={{
              __html: releaseNotes?.body
                ? releaseNotes.body
                    // Escape HTML first
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    // Headers
                    .replace(/^## (.+)$/gm, '<strong style="font-size: 1.1em;">$1</strong>')
                    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
                    // Bold
                    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                    // Links
                    .replace(
                      /\[([^\]]+)\]\(([^)]+)\)/g,
                      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
                    )
                    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
                    // Unordered lists
                    .replace(/(?:^|\n)([*\-] .+(?:\n[*\-] .+)*)/g, (match) => {
                      const items = match.trim().split('\n').map(li => `<li>${li.replace(/^[*\-] /, '')}</li>`).join('')
                      return `<ul>${items}</ul>`
                    })
                    // Line breaks
                    .replace(/\n\n/g, '</p><p>')
                    .replace(/\n/g, '<br/>')
                    // Wrap in paragraph
                    .replace(/^(.*)$/, '<p>$1</p>')
                : 'Check out the latest updates!',
            }}
          />
          {releaseNotes?.html_url && (
            <Typography variant="caption" sx={{ display: 'block', mt: 2 }}>
              <a href={releaseNotes.html_url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>
                View full release on GitHub
              </a>
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleFeatureAlertClose} variant="contained">
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default Dashboard
