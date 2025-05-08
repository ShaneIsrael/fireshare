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
import Tooltip from '@mui/material/Tooltip'
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
import AppsIcon from '@mui/icons-material/Apps'
import TableRowsIcon from '@mui/icons-material/TableRows'
import BugReportIcon from '@mui/icons-material/BugReport'
import StorageIcon from '@mui/icons-material/Storage'
import SyncIcon from '@mui/icons-material/Sync'

import { Grid, ToggleButton, ToggleButtonGroup } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { AuthService, StatsService } from '../../services'

import logo from '../../assets/logo.png'
import Search from '../search/Search'
import LightTooltip from '../misc/LightTooltip'
import SnackbarAlert from '../alert/SnackbarAlert'
import { getSetting, setSetting } from '../../common/utils'
import SliderWrapper from '../misc/SliderWrapper'

const drawerWidth = 240
const minimizedDrawerWidth = 57
const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2

const pages = [
  { title: 'My Videos', icon: <VideoLibraryIcon />, href: '/', private: true },
  { title: 'Public Videos', icon: <PublicIcon />, href: '/feed', private: false },
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
  page,
  collapsed = false,
  searchable = false,
  styleToggle = false,
  cardSlider = false,
  toolbar = true,
  children,
}) {

  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchText, setSearchText] = React.useState()
  const [open, setOpen] = React.useState(!collapsed)
  const [listStyle, setListStyle] = React.useState(getSetting('listStyle') || 'card')
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)

  const [alert, setAlert] = React.useState({ open: false })
  const navigate = useNavigate()

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

  const handleListStyleChange = (e, style) => {
    if (style !== null) {
      setListStyle(style)
      setSetting('listStyle', style)
      // fetchVideos()
    }
  }
  const handleCardSizeChange = (e, value) => {
    const modifier = value / 100
    const newSize = CARD_SIZE_DEFAULT * CARD_SIZE_MULTIPLIER * modifier
    setCardSize(newSize)
    setSetting('cardSize', newSize)
  }

  const DrawerControl = styled('div')(({ theme }) => ({
    zIndex: 1000,
    position: 'absolute',
    left: 0,
    top: 13,
  }))

  const [folderSize, setFolderSize] = React.useState(null); // Disk Usage Service

  React.useEffect(() => {
    const fetchFolderSize = async () => {
      try {
        const data = await StatsService.getFolderSize();
        setFolderSize(data.size_pretty);
      } catch (error) {
        console.error('Error fetching folder size:', error);
      }
    };

    fetchFolderSize();
  }, []);

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
      {styleToggle && (
        <>
          <Divider />
          <Box sx={{ display: 'flex', p: 2 }} justifyContent="center">
            <ToggleButtonGroup
              size="small"
              orientation={open ? 'horizontal' : 'vertical'}
              value={listStyle}
              exclusive
              onChange={handleListStyleChange}
            >
              <ToggleButton sx={{ width: open ? 100 : 'auto' }} value="card">
                <AppsIcon />
              </ToggleButton>
              <ToggleButton sx={{ width: open ? 100 : 'auto' }} value="list">
                <TableRowsIcon />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </>
      )}
      {cardSlider && listStyle === 'card' && (
        <>
          <Divider />
          <Box sx={{ display: 'flex', p: 2, height: open ? 'auto' : 125 }} justifyContent="center">
            <SliderWrapper
              width={open ? '100%' : 5}
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
      <Box sx={{ width: '100%', bottom: 0, position: 'absolute' }}>
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


       
       
        {folderSize !== null ? (
          open ? (
            <Box
              sx={{
                width: 222,
                m: 1,
                height: 40,
                border: '1px solid rgba(194, 224, 255, 0.18)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                pl: 2,
                pr: 2,
                color: '#EBEBEB',
                fontWeight: 600,
                fontSize: 13,
                backgroundColor: 'transparent',
                ':hover': {
                  backgroundColor: 'rgba(194, 224, 255, 0.08)',
                },
              }}
            >
              <Grid container alignItems="center">
                <Grid item>
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 600,
                      fontSize: 12,
                      color: '#EBEBEB',
                    }}
                  >
                    Disk Usage:{' '}
                    <Box component="span" sx={{ color: '#2684FF' }}>
                      {folderSize}
                    </Box>
                  </Typography>
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Tooltip title={`Disk Usage: ${folderSize}`} arrow placement="right">
              <Box
                sx={{
                  width: 42,
                  m: 1,
                  height: 40,
                  border: '1px solid rgba(194, 224, 255, 0.18)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  ':hover': {
                    backgroundColor: 'rgba(194, 224, 255, 0.08)',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: 15,
                    color: '#EBEBEB',
                  }}
                >
                  <IconButton sx={{ p: 0.5, pointerEvents: 'all' }}>
                    <StorageIcon sx={{ color: '#EBEBEB' }} />
                  </IconButton>
                </Typography>
              </Box>
            </Tooltip>
            
          )
        ) : (
          <Box
            sx={{
              width: open ? 222 : 42,
              m: 1,
              height: 40,
              border: '1px solid rgba(194, 224, 255, 0.18)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#888',
              fontWeight: 600,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            
            {open ? <Typography variant="body2" color="textSecondary">Loading Disk Usage...</Typography> : <SyncIcon
              sx={{
                animation: "spin 2s linear infinite",
                "@keyframes spin": {
                  "0%": {
                    transform: "rotate(360deg)",
                  },
                  "100%": {
                    transform: "rotate(0deg)",
                  },
                },
              }}
            /> }
          </Box>
          
        )}



        {open ? (
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
                    v{process.env.REACT_APP_VERSION}
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
          <Toolbar sx={{ backgroundColor: 'rgba(0,0,0,0)' }}>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { sm: 'none' } }}
            >
              <MenuIcon />
            </IconButton>
            {searchable && (
              <Search
                placeholder={`Search videos...`}
                searchHandler={(value) => setSearchText(value)}
                sx={{ width: '100%', ml: { xs: 0, sm: 2 } }}
              />
            )}
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
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: open ? drawerWidth : minimizedDrawerWidth },
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
          p: page !== '/w' ? 3 : 0,
          width: { sm: `calc(100% - ${open ? drawerWidth : minimizedDrawerWidth}px)` },
        }}
      >
        {toolbar && <Toolbar />}
        <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
          {alert.message}
        </SnackbarAlert>
        {React.cloneElement(children, { authenticated, searchText, listStyle, cardSize })}
      </Box>
    </Box>
  )
}

export default Navbar20
