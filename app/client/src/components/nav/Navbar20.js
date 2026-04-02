import * as React from 'react'

import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import MuiDrawer from '@mui/material/Drawer'
import MuiAppBar from '@mui/material/AppBar'
import { styled } from '@mui/material/styles'

import MenuIcon from '@mui/icons-material/Menu'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import PublicIcon from '@mui/icons-material/Public'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import GitHubIcon from '@mui/icons-material/GitHub'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import BugReportIcon from '@mui/icons-material/BugReport'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'

import { Grid, useMediaQuery, useTheme } from '@mui/material'
import { useNavigate, useLocation } from 'react-router-dom'
import { AuthService } from '../../services'

import logo from '../../assets/logo.png'
import Search from '../search/Search'
import LightTooltip from '../misc/LightTooltip'
import SnackbarAlert from '../alert/SnackbarAlert'
import { getSetting, setSetting } from '../../common/utils'
import SliderWrapper from '../misc/SliderWrapper'
import GameScanStatus from './GameScanStatus'
import TranscodingStatus from './TranscodingStatus'
import FolderSuggestionInline from './FolderSuggestionInline'
import DiskSpaceIndicator from './DiskSpaceIndicator'
import { GameService } from '../../services'
import UploadCard from '../cards/UploadCard'
import { RegisterUploadCardContext } from '../utils/GlobalDragDropOverlay'
import Select from 'react-select'
import selectFolderTheme from '../../common/reactSelectFolderTheme'

const drawerWidth = 240
const minimizedDrawerWidth = 57
const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2

const allPages = [
  { title: 'My Videos', icon: <VideoLibraryIcon />, href: '/', private: true },
  { title: 'Public Videos', icon: <PublicIcon />, href: '/feed', private: false },
  { title: 'Games', icon: <SportsEsportsIcon />, href: '/games', private: false },
  { title: 'Tags', icon: <LocalOfferIcon />, href: '/tags', private: false },
  { title: 'Settings', icon: <SettingsIcon />, href: '/settings', private: true },
]

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
})

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: minimizedDrawerWidth,
  [theme.breakpoints.up('sm')]: {
    width: minimizedDrawerWidth,
  },
})

const IconDrawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
  width: open ? drawerWidth : minimizedDrawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}))

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer,
  [theme.breakpoints.up('sm')]: {
    zIndex: theme.zIndex.drawer + 1,
  },
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: `calc(100% - ${drawerWidth}px)`,
      marginLeft: drawerWidth,
    },
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  ...(!open && {
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: `calc(100% - ${minimizedDrawerWidth}px)`,
      marginLeft: minimizedDrawerWidth,
    },
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}))

function Navbar20({
  authenticated,
  showReleaseNotes,
  releaseNotes,
  page,
  collapsed = false,
  searchable = false,
  searchPlaceholder = 'Search videos...',
  cardSlider = false,
  toolbar = true,
  mainPadding = 3,
  children,
}) {
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchText, setSearchText] = React.useState()
  const [open, setOpen] = React.useState(!collapsed)
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)

  const [alert, setAlert] = React.useState({ open: false })
  const [uploadTick, setUploadTick] = React.useState(0)
  const registerUploadCard = React.useContext(RegisterUploadCardContext)
  const [folderSuggestions, setFolderSuggestions] = React.useState({})
  const [currentSuggestionFolder, setCurrentSuggestionFolder] = React.useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const effectiveOpen = isMobile ? true : open

  // --- Folder selection state (shared with Feed / Dashboard) ---
  const [folders, setFolders] = React.useState(['All Videos'])

  // Initialise selectedFolder from URL ?category= (feed) or localStorage
  const initFolder = React.useMemo(() => {
    if (page === '/feed') {
      const params = new URLSearchParams(location.search)
      const cat = params.get('category')
      if (cat) return { value: cat, label: cat }
    }
    return getSetting('folder') || { value: 'All Videos', label: 'All Videos' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  const [selectedFolder, setSelectedFolder] = React.useState(initFolder)

  // On mobile, force "All Videos"
  const effectiveFolder = isMobile ? { value: 'All Videos', label: 'All Videos' } : selectedFolder

  const handleFolderChange = React.useCallback(
    (folder) => {
      setSetting('folder', folder)
      setSelectedFolder(folder)
      // Keep URL in sync when on the feed page
      if (page === '/feed' && 'URLSearchParams' in window) {
        const searchParams = new URLSearchParams('')
        searchParams.set('category', folder.value)
        window.history.replaceState({ category: folder.value }, '', `/#/feed?${searchParams.toString()}`)
      }
    },
    [page],
  )

  const handleFoldersLoaded = React.useCallback((folderList) => {
    setFolders(folderList)
  }, [])

  const createSelectFolders = (f) => f.map((v) => ({ value: v, label: v }))

  const [uiConfig, setUiConfig] = React.useState(() => getSetting('ui_config') || {})

  React.useEffect(() => {
    const handleUiConfigUpdate = () => setUiConfig(getSetting('ui_config') || {})
    window.addEventListener('ui_config_updated', handleUiConfigUpdate)
    return () => window.removeEventListener('ui_config_updated', handleUiConfigUpdate)
  }, [])

  const pages = allPages.filter((p) => {
    if (p.href === '/' && uiConfig.show_my_videos === false) return false
    if (p.href === '/feed' && uiConfig.show_public_videos === false) return false
    if (p.href === '/games' && uiConfig.show_games === false) return false
    if (p.href === '/tags' && uiConfig.show_tags === false) return false
    return true
  })

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleDrawerCollapse = () => {
    setOpen(!open)
    setSetting('drawerOpen', !open)
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const handleCardSizeChange = (e, newValue) => {
    const newSize = Math.round((newValue / 100) * CARD_SIZE_DEFAULT * CARD_SIZE_MULTIPLIER)
    setCardSize(newSize)
    setSetting('cardSize', newSize)
  }

  const DrawerControl = styled('div')(({ theme }) => ({
    zIndex: 1000,
    position: 'absolute',
    left: 0,
    top: 13,
  }))

  const memoizedHandleAlert = React.useCallback((alert) => {
    setAlert(alert)
  }, [])

  // Load pending folder suggestions on mount
  React.useEffect(() => {
    if (!authenticated) return

    const loadPendingSuggestions = async () => {
      try {
        const res = await GameService.getFolderSuggestions()
        const suggestions = res.data
        if (Object.keys(suggestions).length > 0) {
          setFolderSuggestions(suggestions)
          setCurrentSuggestionFolder(Object.keys(suggestions)[0])
        }
      } catch (err) {
        // Ignore errors
      }
    }

    loadPendingSuggestions()
  }, [authenticated])

  // Game scan complete handler
  const handleGameScanComplete = React.useCallback(async (data) => {
    console.log('[Navbar20] handleGameScanComplete called with data:', data)
    setAlert({
      open: true,
      type: 'success',
      message: data.total > 0 ? `Game scan complete! Check remaining suggestions in My Videos.` : 'Game scan complete!',
    })

    await new Promise((resolve) => setTimeout(resolve, 500))

    try {
      console.log('[Navbar20] Fetching folder suggestions...')
      const res = await GameService.getFolderSuggestions()
      const suggestions = res.data
      console.log('[Navbar20] Folder suggestions response:', suggestions)
      if (Object.keys(suggestions).length > 0) {
        console.log('[Navbar20] Setting folder suggestions for:', Object.keys(suggestions)[0])
        setFolderSuggestions(suggestions)
        setCurrentSuggestionFolder(Object.keys(suggestions)[0])
      }
    } catch (err) {
      console.error('[Navbar20] Error fetching folder suggestions:', err)
    }
  }, [])

  const handleFolderSuggestionApplied = (folderName, gameName, videoCount) => {
    setAlert({
      open: true,
      type: 'success',
      message: `Linked ${videoCount} clips to ${gameName}`,
    })
    // Show next suggestion or close
    const remaining = { ...folderSuggestions }
    delete remaining[folderName]
    setFolderSuggestions(remaining)
    const nextFolder = Object.keys(remaining)[0]
    setCurrentSuggestionFolder(nextFolder || null)
  }

  const handleFolderSuggestionClose = () => {
    // Show next suggestion or close
    const remaining = { ...folderSuggestions }
    delete remaining[currentSuggestionFolder]
    setFolderSuggestions(remaining)
    const nextFolder = Object.keys(remaining)[0]
    setCurrentSuggestionFolder(nextFolder || null)
  }

  const drawer = (
    <div>
      <Toolbar
        sx={{
          '&.MuiToolbar-root': {
            pl: '13px',
          },
        }}
      >
        <Box
          alt="fireshare logo"
          component="img"
          src={logo}
          height={42}
          onClick={() => navigate(authenticated ? '/' : '/feed')}
          sx={{ pr: 2, cursor: 'pointer' }}
        />
        <Typography
          variant="div"
          noWrap
          onClick={() => navigate(authenticated ? '/' : '/feed')}
          sx={{
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: 26,
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          Fireshare
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ p: 1 }}>
        {pages.map((p) => {
          if ((p.private && authenticated) || !p.private)
            return (
              <ListItem key={p.title} disablePadding>
                <ListItemButton selected={page === p.href} onClick={() => navigate(p.href)} sx={{ height: 50, mb: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>{p.icon}</ListItemIcon>
                  <ListItemText
                    primary={p.title}
                    primaryTypographyProps={{
                      fontSize: 18,
                      fontWeight: 600,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )
          return null
        })}
      </List>
      {/* Folder selector — hidden on mobile (xs) */}
      {(page === '/' || page === '/feed') &&
        open &&
        !isMobile &&
        folders.length > 1 &&
        uiConfig.show_folder_dropdown === true && (
          <>
            <Divider />
            <Box sx={{ p: open ? 1.5 : 0.75 }}>
              {open ? (
                <Select
                  value={selectedFolder}
                  options={createSelectFolders(folders)}
                  onChange={handleFolderChange}
                  styles={selectFolderTheme}
                  blurInputOnSelect
                  isSearchable={false}
                  menuPlacement="auto"
                />
              ) : (
                <LightTooltip title={selectedFolder.label} placement="right" arrow>
                  <Box
                    sx={{
                      width: 42,
                      height: 38,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid #FFFFFF26',
                      borderRadius: '8px',
                      backgroundColor: '#FFFFFF0D',
                      cursor: 'pointer',
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      // Cycle through folders
                      const idx = folders.indexOf(selectedFolder.value)
                      const next = folders[(idx + 1) % folders.length]
                      handleFolderChange({ value: next, label: next })
                    }}
                  >
                    {selectedFolder.label.substring(0, 3)}
                  </Box>
                </LightTooltip>
              )}
            </Box>
          </>
        )}
      {cardSlider && open && !isMobile && (
        <>
          <Divider />
          <Box sx={{ display: 'flex', p: 2 }} justifyContent="center">
            <SliderWrapper
              width={open ? 150 : 10}
              h
              cardSize={cardSize}
              defaultCardSize={CARD_SIZE_DEFAULT}
              cardSizeMultiplier={CARD_SIZE_MULTIPLIER}
              onChangeCommitted={handleCardSizeChange}
              vertical={!open}
            />
          </Box>
        </>
      )}
      <Divider />
      <UploadCard ref={registerUploadCard} authenticated={authenticated} handleAlert={memoizedHandleAlert} mini={!effectiveOpen} onUploadComplete={() => setUploadTick((t) => t + 1)} />

      <Box sx={{ width: '100%', bottom: 0, position: 'absolute' }}>
        <GameScanStatus open={effectiveOpen} onComplete={handleGameScanComplete} authenticated={authenticated} />
        <TranscodingStatus open={effectiveOpen} authenticated={authenticated} />
        <FolderSuggestionInline
          open={effectiveOpen}
          suggestion={currentSuggestionFolder ? folderSuggestions[currentSuggestionFolder] : null}
          folderName={currentSuggestionFolder}
          onApplied={handleFolderSuggestionApplied}
          onDismiss={handleFolderSuggestionClose}
        />
        <DiskSpaceIndicator open={effectiveOpen} visible={authenticated} />
        <List sx={{ pl: 1, pr: 1 }}>
          {authenticated && (
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout} sx={{ height: 50, backgroundColor: 'rgba(194, 224, 255, 0.08)' }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Logout"
                  primaryTypographyProps={{
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                />
              </ListItemButton>
            </ListItem>
          )}
          {!authenticated && (
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => navigate('/login')}
                sx={{ height: 50, backgroundColor: 'rgba(194, 224, 255, 0.08)' }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LoginIcon />
                </ListItemIcon>
                <ListItemText
                  primary="Login"
                  primaryTypographyProps={{
                    fontSize: 18,
                    fontWeight: 600,
                  }}
                />
              </ListItemButton>
            </ListItem>
          )}
        </List>
        <Divider />
        {effectiveOpen ? (
          <Box
            sx={{
              width: 222,
              m: 1,
              height: 40,
              border: '1px solid rgba(194, 224, 255, 0.18)',
              borderRadius: '8px',
              ':hover': {
                backgroundColor: 'rgba(194, 224, 255, 0.08)',
                cursor: 'pointer',
              },
            }}
            onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
          >
            <Grid container alignItems="center" sx={{ height: '100%' }}>
              <Grid item sx={{ ml: 1, mr: 1 }}>
                <IconButton aria-label="report-bug-link" sx={{ p: 0.5, pointerEvents: 'all' }}>
                  <GitHubIcon sx={{ color: '#EBEBEB' }} />
                </IconButton>
              </Grid>
              <Grid container item direction="column" xs>
                <Grid item>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#EBEBEB' }}>
                    Fireshare
                  </Typography>
                </Grid>
                <Grid item>
                  <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#2684FF' }}>
                    v{import.meta.env.VITE_VERSION}
                  </Typography>
                </Grid>
              </Grid>
              <Grid container item xs>
                <LightTooltip arrow title="Found a bug? Report it here.">
                  <IconButton
                    aria-label="report-bug-link"
                    size="medium"
                    sx={{ p: 0.5, mr: 1, pointerEvents: 'all' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open('https://github.com/ShaneIsrael/fireshare/issues', '_blank')
                    }}
                  >
                    <BugReportIcon fontSize="inherit" />
                  </IconButton>
                </LightTooltip>
                <LightTooltip arrow title="Buy us a coffee!">
                  <IconButton
                    aria-label="paypal-link"
                    size="medium"
                    sx={{ p: 0.5, pointerEvents: 'all' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open('https://www.paypal.com/paypalme/shaneisrael', '_blank')
                    }}
                  >
                    <VolunteerActivismIcon fontSize="inherit" />
                  </IconButton>
                </LightTooltip>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box
            sx={{
              display: 'flex',
              width: 42,
              m: 1,
              height: 40,
              border: '1px solid rgba(194, 224, 255, 0.18)',
              borderRadius: '8px',
              ':hover': {
                backgroundColor: 'rgba(194, 224, 255, 0.08)',
                cursor: 'pointer',
              },
            }}
            justifyContent="center"
            alignItems="center"
            onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
          >
            <IconButton aria-label="report-bug-link" sx={{ p: 0.5, pointerEvents: 'all' }}>
              <GitHubIcon sx={{ color: '#EBEBEB' }} />
            </IconButton>
          </Box>
        )}
      </Box>
    </div>
  )
  return (
    <Box sx={{ display: 'flex' }}>
      {page !== '/login' && (
        <AppBar
          position="fixed"
          open={open}
          sx={{
            backgroundColor: '#0A1929D0',
          }}
        >
          <DrawerControl
            sx={{
              display: { xs: 'none', sm: 'block' },
            }}
          >
            <IconButton onClick={handleDrawerCollapse}>{open ? <ChevronLeftIcon /> : <ChevronRightIcon />}</IconButton>
          </DrawerControl>
          <Toolbar sx={{ backgroundColor: 'rgba(0,0,0,0)', gap: 1 }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ display: 'flex', width: '100%', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
              {searchable && (
                <Box id="navbar-search-container" sx={{ flexGrow: 1, minWidth: 0, ml: { xs: 0, sm: 2 } }}>
                  <Search placeholder={searchPlaceholder} searchHandler={(value) => setSearchText(value)} />
                </Box>
              )}
              <Box id="navbar-toolbar-extra" />
            </Box>
          </Toolbar>
        </AppBar>
      )}
      {page !== '/login' && (
        <Box
          component="nav"
          sx={{ width: { sm: open ? drawerWidth : minimizedDrawerWidth }, flexShrink: { sm: 0 } }}
          aria-label="page navigation"
        >
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: effectiveOpen ? drawerWidth : minimizedDrawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <IconDrawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
            }}
            open={open}
          >
            {drawer}
          </IconDrawer>
        </Box>
      )}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: page !== '/w' ? mainPadding : 0,
          width: { sm: `calc(100% - ${open ? drawerWidth : minimizedDrawerWidth}px)` },
          overflowX: 'hidden',
        }}
      >
        {toolbar && <Toolbar />}
        <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
          {alert.message}
        </SnackbarAlert>
        {React.cloneElement(children, {
          authenticated,
          searchText,
          cardSize,
          showReleaseNotes,
          releaseNotes,
          selectedFolder: effectiveFolder,
          onFolderChange: handleFolderChange,
          onFoldersLoaded: handleFoldersLoaded,
          uploadTick,
        })}
      </Box>
    </Box>
  )
}

export default Navbar20
