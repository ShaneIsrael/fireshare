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
import SearchIcon from '@mui/icons-material/Search'
import CloseIcon from '@mui/icons-material/Close'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'

import { useMediaQuery, useTheme } from '@mui/material'
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
import ImageUploadCard from '../cards/ImageUploadCard'
import { RegisterUploadCardContext, RegisterImageUploadCardContext } from '../utils/GlobalDragDropOverlay'
import Select from 'react-select'
import VersionBox from './VersionBox'
import ReleaseNotesDialog from '../modal/ReleaseNotesDialog'

const drawerWidth = 240
const minimizedDrawerWidth = 57
const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2
const DEMO_BANNER_HEIGHT = 34

const allPages = [
  { title: 'Videos', icon: <VideoLibraryIcon />, href: '/', private: false },
  { title: 'Images', icon: <PhotoLibraryIcon />, href: '/images', private: false },
  { title: 'Games', icon: <SportsEsportsIcon />, href: '/games', private: false },
  { title: 'Tags', icon: <LocalOfferIcon />, href: '/tags', private: false },
  { title: 'File Manager', icon: <FolderOpenIcon />, href: '/files', private: true },
  { title: 'Settings', icon: <SettingsIcon />, href: '/settings', private: true },
]

const openedMixin = (theme) => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
  overflowY: 'hidden',
})

const closedMixin = (theme) => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  overflowY: 'hidden',
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
  isAdmin,
  latestRelease,
  page,
  collapsed = false,
  searchable = false,
  searchPlaceholder = 'Search videos...',
  cardSlider = false,
  toolbar = true,
  mainPadding = 3,
  children,
}) {
  const [logoHovered, setLogoHovered] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false)
  const [mobileSearchKey, setMobileSearchKey] = React.useState(0)
  const [searchText, setSearchText] = React.useState()
  const [open, setOpen] = React.useState(!collapsed)
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)

  const [featureAlertOpen, setFeatureAlertOpen] = React.useState(false)

  // Auto-open release notes on first visit when a new version is available
  React.useEffect(() => {
    if (!latestRelease?.version) return
    const cookieName = 'release_notes_seen_version'
    const seenVersion = document.cookie
      .split('; ')
      .find((c) => c.startsWith(cookieName + '='))
      ?.split('=')[1]
    if (seenVersion !== latestRelease.version) {
      setFeatureAlertOpen(true)
    }
  }, [latestRelease])

  const handleReleaseNotesClose = React.useCallback(() => {
    if (latestRelease?.version) {
      const expires = new Date()
      expires.setFullYear(expires.getFullYear() + 1)
      document.cookie = `release_notes_seen_version=${latestRelease.version}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`
    }
    setFeatureAlertOpen(false)
  }, [latestRelease])

  const [alert, setAlert] = React.useState({ open: false })
  const [uploadTick, setUploadTick] = React.useState(0)
  const registerUploadCard = React.useContext(RegisterUploadCardContext)
  const registerImageUploadCard = React.useContext(RegisterImageUploadCardContext)
  const [folderSuggestions, setFolderSuggestions] = React.useState({})
  const [currentSuggestionFolder, setCurrentSuggestionFolder] = React.useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const effectiveOpen = isMobile ? true : open

  // --- Folder selection state (shared with Dashboard) ---
  const [folders, setFolders] = React.useState(['All Videos'])

  // Initialise selectedFolder from URL ?category= or localStorage
  const initFolder = React.useMemo(() => {
    const params = new URLSearchParams(location.search)
    const cat = params.get('category')
    if (cat) return { value: cat, label: cat }
    return getSetting('folder') || { value: 'All Videos', label: 'All Videos' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // run once on mount

  const [selectedFolder, setSelectedFolder] = React.useState(initFolder)

  const effectiveFolder = selectedFolder

  const handleFolderChange = React.useCallback((folder) => {
    setSetting('folder', folder)
    setSelectedFolder(folder)
  }, [])

  const handleFoldersLoaded = React.useCallback((folderList) => {
    setFolders(folderList)
  }, [])

  // --- Image folder selection state ---
  const [imageFolders, setImageFolders] = React.useState(['All Images'])
  const [selectedImageFolder, setSelectedImageFolder] = React.useState({ value: 'All Images', label: 'All Images' })
  const effectiveImageFolder = selectedImageFolder

  const handleImageFolderChange = React.useCallback((folder) => {
    setSelectedImageFolder(folder)
  }, [])

  const handleImageFoldersLoaded = React.useCallback((folderList) => {
    setImageFolders(folderList)
  }, [])

const [uiConfig, setUiConfig] = React.useState(() => getSetting('ui_config') || {})

  React.useEffect(() => {
    const handleUiConfigUpdate = () => setUiConfig(getSetting('ui_config') || {})
    window.addEventListener('ui_config_updated', handleUiConfigUpdate)
    return () => window.removeEventListener('ui_config_updated', handleUiConfigUpdate)
  }, [])

  const pages = allPages.filter((p) => {
    if (p.adminOnly && !isAdmin) return false
    if (p.href === '/' && uiConfig.show_videos === false) return false
    if (p.href === '/images' && uiConfig.show_images === false) return false
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

  const handleCardSizeChange = (_e, newValue) => {
    const newSize = Math.round((newValue / 100) * CARD_SIZE_DEFAULT * CARD_SIZE_MULTIPLIER)
    setCardSize(newSize)
    setSetting('cardSize', newSize)
  }

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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── Fixed header: logo ───────────────────────────────────────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <Toolbar
          sx={{
            '&.MuiToolbar-root': {
              pl: '13px',
              pr: '8px',
            },
          }}
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          <Box
            alt="fireshare logo"
            component="img"
            src={logo}
            height={42}
            onClick={() => navigate('/')}
            sx={{
              pr: open ? 2 : 0,
              cursor: 'pointer',
              flexShrink: 0,
              opacity: !open && logoHovered ? 0 : 1,
              transition: 'opacity 0.15s',
            }}
          />
          {open && (
            <>
              <Typography
                variant="div"
                noWrap
                onClick={() => navigate('/')}
                sx={{
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: 26,
                  color: 'inherit',
                  textDecoration: 'none',
                  flex: 1,
                }}
              >
                Fireshare
              </Typography>
              <IconButton
                onClick={handleDrawerCollapse}
                sx={{
                  flexShrink: 0,
                  opacity: logoHovered ? 1 : 0,
                  transition: 'opacity 0.15s',
                  display: { xs: 'none', sm: 'inline-flex' },
                }}
              >
                <ChevronLeftIcon />
              </IconButton>
            </>
          )}
          {!open && logoHovered && (
            <IconButton
              onClick={handleDrawerCollapse}
              sx={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                width: '100%',
                borderRadius: 0,
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.45)',
              }}
            >
              <ChevronRightIcon />
            </IconButton>
          )}
        </Toolbar>
        <Divider />
      </Box>

      {/* ── Scrollable middle: nav + folder + slider + uploads ───────────────── */}
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(194, 224, 255, 0.15)',
            borderRadius: 2,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(194, 224, 255, 0.3)',
          },
        }}
      >
        <List sx={{ pt: 1 }}>
          {pages.map((p) => {
            if ((p.private && authenticated) || !p.private)
              return (
                <>
                  {p.href === '/files' && <Divider sx={{ mb: 1, width: '100%' }} />}
                  <ListItem key={p.title} disablePadding sx={{ px: 1 }}>
                    <ListItemButton
                      selected={page === p.href}
                      onClick={() => navigate(p.href)}
                      sx={{ height: 50, mb: p.href !== '/settings' ? 1 : 0 }}
                    >
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
                </>
              )
            return null
          })}
        </List>
        {cardSlider && open && !isMobile ? (
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
        ) : null}
        <Divider />
        <UploadCard
          ref={registerUploadCard}
          authenticated={authenticated}
          handleAlert={memoizedHandleAlert}
          mini={!effectiveOpen}
          onUploadComplete={() => setUploadTick((t) => t + 1)}
        />
        <ImageUploadCard
          ref={registerImageUploadCard}
          authenticated={authenticated}
          handleAlert={memoizedHandleAlert}
          mini={!effectiveOpen}
          onUploadComplete={() => setUploadTick((t) => t + 1)}
        />
      </Box>

      {/* ── Fixed footer: status indicators + logout + info boxes ────────────── */}
      <Box sx={{ flexShrink: 0 }}>
        <GameScanStatus open={effectiveOpen} onComplete={handleGameScanComplete} authenticated={authenticated} />
        <TranscodingStatus open={effectiveOpen} authenticated={authenticated} />
        <FolderSuggestionInline
          open={effectiveOpen}
          suggestion={currentSuggestionFolder ? folderSuggestions[currentSuggestionFolder] : null}
          folderName={currentSuggestionFolder}
          onApplied={handleFolderSuggestionApplied}
          onDismiss={handleFolderSuggestionClose}
        />
        <Divider />
        {authenticated ? (
          <LightTooltip arrow title={effectiveOpen ? '' : 'Logout'} placement="right">
            <Box
              onClick={handleLogout}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: 1,
                my: 1,
                px: effectiveOpen ? 1.5 : 0,
                height: 40,
                border: '1px solid rgba(194, 224, 255, 0.18)',
                borderRadius: '8px',
                cursor: 'pointer',
                justifyContent: effectiveOpen ? 'flex-start' : 'center',
                color: 'rgba(255, 100, 100, 0.6)',
                '&:hover': {
                  backgroundColor: 'rgba(255, 80, 80, 0.08)',
                  borderColor: 'rgba(255, 100, 100, 0.35)',
                  color: '#FF6B6B',
                },
                transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
              }}
            >
              <LogoutIcon sx={{ fontSize: 18, flexShrink: 0 }} />
              {effectiveOpen && (
                <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', userSelect: 'none' }}>
                  Logout
                </Typography>
              )}
            </Box>
          </LightTooltip>
        ) : (
          <LightTooltip arrow title={effectiveOpen ? '' : 'Login'} placement="right">
            <Box
              onClick={() => navigate('/login')}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mx: 1,
                my: 1,
                px: effectiveOpen ? 1.5 : 0,
                height: 40,
                border: '1px solid rgba(194, 224, 255, 0.18)',
                borderRadius: '8px',
                cursor: 'pointer',
                justifyContent: effectiveOpen ? 'flex-start' : 'center',
                color: 'rgba(38, 132, 255, 0.7)',
                '&:hover': {
                  backgroundColor: 'rgba(38, 132, 255, 0.08)',
                  borderColor: 'rgba(38, 132, 255, 0.4)',
                  color: '#2684FF',
                },
                transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
              }}
            >
              <LoginIcon sx={{ fontSize: 18, flexShrink: 0 }} />
              {effectiveOpen && (
                <Typography sx={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', userSelect: 'none' }}>
                  Login
                </Typography>
              )}
            </Box>
          </LightTooltip>
        )}
        <DiskSpaceIndicator open={effectiveOpen} visible={authenticated} />
        <VersionBox open={effectiveOpen} releaseNotes={latestRelease} onUpdateClick={() => setFeatureAlertOpen(true)} />
      </Box>
    </Box>
  )
  const isDemoUser = getSetting('is_demo_user')
  const demoMode = getSetting('demo_mode')
  const showDemoBanner = (isDemoUser || (demoMode && !authenticated)) && page !== '/login'

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {showDemoBanner && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            height: DEMO_BANNER_HEIGHT,
            bgcolor: '#1a1200',
            borderBottom: '1px solid rgba(255, 152, 0, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            zIndex: (theme) => theme.zIndex.drawer - 1,
          }}
        >
          <Box
            sx={{
              px: 0.75,
              py: 0.1,
              bgcolor: 'rgba(255, 152, 0, 0.15)',
              border: '1px solid rgba(255, 152, 0, 0.3)',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: '#FFB74D',
              userSelect: 'none',
            }}
          >
            DEMO
          </Box>
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255, 200, 120, 0.7)', letterSpacing: '0.02em' }}>
            Some actions are disabled
            {!authenticated && (
              <>
                {' — sign in with '}
                <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFB74D' }}>
                  demo
                </Box>
                {' / '}
                <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFB74D' }}>
                  demo
                </Box>
              </>
            )}
          </Typography>
        </Box>
      )}
      {page !== '/login' &&
        page !== '/watch' &&
        (isMobile || (page !== '/files' && page !== '/settings' && page !== '/image')) && (
          <AppBar
            position="fixed"
            open={open}
            sx={{
              backgroundColor: '#0A1929D0',
              top: showDemoBanner ? DEMO_BANNER_HEIGHT : 0,
            }}
          >
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
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center' }}>
                {/* Mobile: expanded search */}
                {isMobile && mobileSearchOpen && searchable && (
                  <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
                    <Search
                      key={mobileSearchKey}
                      placeholder={searchPlaceholder}
                      searchHandler={(value) => setSearchText(value)}
                      autoFocus
                    />
                  </Box>
                )}
                {isMobile && mobileSearchOpen && (
                  <IconButton
                    color="inherit"
                    size="small"
                    onClick={() => {
                      setMobileSearchOpen(false)
                      setSearchText('')
                      setMobileSearchKey((k) => k + 1)
                    }}
                    sx={{ flexShrink: 0 }}
                  >
                    <CloseIcon />
                  </IconButton>
                )}

                {/* Desktop: left spacer + centered search */}
                {!isMobile && <Box sx={{ flex: 1 }} />}
                {searchable && !isMobile && (
                  <Box id="navbar-search-container" sx={{ width: 520, flexShrink: 1, minWidth: 0, mr: 1, ml: 2 }}>
                    <Search placeholder={searchPlaceholder} searchHandler={(value) => setSearchText(value)} />
                  </Box>
                )}

                {/* Right controls — always in DOM so portal target stays valid */}
                <Box
                  sx={{
                    flex: 1,
                    display: isMobile && mobileSearchOpen ? 'none' : 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box id="navbar-toolbar-extra" />
                  {searchable && isMobile && (
                    <IconButton
                      color="inherit"
                      size="small"
                      onClick={() => setMobileSearchOpen(true)}
                      sx={{
                        borderRadius: '8px',
                        height: '38px',
                        width: '38px',
                        border: '1px solid #FFFFFF33',
                        bgcolor: 'transparent',
                        color: '#FFFFFFCC',
                        '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
                      }}
                    >
                      <SearchIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
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
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: effectiveOpen ? drawerWidth : minimizedDrawerWidth,
                overflowY: 'hidden',
              },
            }}
          >
            {drawer}
          </Drawer>
          <IconDrawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              ...(showDemoBanner && {
                '& .MuiDrawer-paper': {
                  top: DEMO_BANNER_HEIGHT,
                  height: `calc(100% - ${DEMO_BANNER_HEIGHT}px)`,
                },
              }),
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
          minHeight: 0,
          p: page !== '/watch' && page !== '/image' ? mainPadding : 0,
          width: { sm: `calc(100% - ${open ? drawerWidth : minimizedDrawerWidth}px)` },
          overflowX: 'hidden',
          overflowY: 'auto',
          ...(page === '/w' && {
            overflow: 'hidden',
          }),
        }}
      >
        {showDemoBanner && <Box sx={{ height: DEMO_BANNER_HEIGHT, flexShrink: 0 }} />}
        {toolbar &&
          page !== '/watch' &&
          (isMobile || (page !== '/files' && page !== '/settings' && page !== '/image')) && <Toolbar />}
        <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
          {alert.message}
        </SnackbarAlert>
        {React.cloneElement(children, {
          authenticated,
          isAdmin,
          searchText,
          cardSize,
          selectedFolder: effectiveFolder,
          onFolderChange: handleFolderChange,
          onFoldersLoaded: handleFoldersLoaded,
          selectedImageFolder: effectiveImageFolder,
          onImageFolderChange: handleImageFolderChange,
          onImageFoldersLoaded: handleImageFoldersLoaded,
          showFolderDropdown: uiConfig.show_folder_dropdown === true,
          uploadTick,
        })}
      </Box>
      <ReleaseNotesDialog open={featureAlertOpen} onClose={handleReleaseNotesClose} authenticated={authenticated} />
    </Box>
  )
}

export default Navbar20
