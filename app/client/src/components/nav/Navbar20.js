import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Drawer from '@mui/material/Drawer'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import MenuIcon from '@mui/icons-material/Menu'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import InfoIcon from '@mui/icons-material/Info'
import PublicIcon from '@mui/icons-material/Public'
import SettingsIcon from '@mui/icons-material/Settings'
import LogoutIcon from '@mui/icons-material/Logout'
import LoginIcon from '@mui/icons-material/Login'
import GitHubIcon from '@mui/icons-material/GitHub'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import BugReportIcon from '@mui/icons-material/BugReport'

import { Avatar, Grid, Menu, MenuItem, Tooltip } from '@mui/material'
import { lightBlue } from '@mui/material/colors'
import { useNavigate } from 'react-router-dom'
import { AuthService, VideoService } from '../../services'

import logo from '../../assets/logo.png'
import Search from '../search/Search'
import LightTooltip from '../misc/LightTooltip'
const drawerWidth = 240

const pages = [
  { title: 'All Videos', icon: <VideoLibraryIcon />, href: '/', private: true },
  { title: 'Public Videos', icon: <PublicIcon />, href: '/feed', private: false },
  { title: 'Settings', icon: <SettingsIcon />, href: '/settings', private: true },
]

function Navbar20({ authenticated, page, children }) {
  const [anchorElUser, setAnchorElUser] = React.useState(null)
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [searchText, setSearchText] = React.useState()

  const [alert, setAlert] = React.useState({ open: false })

  const navigate = useNavigate()

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget)
  }
  const handleCloseUserMenu = () => {
    setAnchorElUser(null)
  }

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const handleScan = async () => {
    VideoService.scan().catch((err) =>
      setAlert({
        open: true,
        type: 'error',
        message: err.response?.data || 'Unknown Error',
      }),
    )
    setAlert({
      open: true,
      type: 'info',
      message: 'Scan initiated. This could take a few minutes.',
    })
  }

  const menuOptions = []
  if (authenticated) {
    menuOptions.push({ name: 'Scan Library', handler: handleScan })
  }

  const drawer = (
    <div>
      <Toolbar>
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
        })}
      </List>
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
        <Box
          sx={{
            width: 205,
            m: 2,
            height: 50,
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
      </Box>
    </div>
  )

  return (
    <Box sx={{ display: 'flex' }}>
      {page !== '/login' && (
        <AppBar
          position="fixed"
          sx={{
            width: { sm: `calc(100% - ${drawerWidth}px)` },
            ml: { sm: `${drawerWidth}px` },
            backgroundColor: '#0A1929D0',
          }}
        >
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
            <Search
              placeholder={`Search videos...`}
              searchHandler={(value) => setSearchText(value)}
              sx={{ width: '100%', mr: 1 }}
            />
            {authenticated && (
              <Box sx={{ flexGrow: 0 }}>
                <Tooltip title="Open Options">
                  <IconButton onClick={handleOpenUserMenu} sx={{ p: 0 }}>
                    <Avatar alt="Admin" sx={{ bgcolor: lightBlue[500] }}>
                      <AdminPanelSettingsIcon />
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Menu
                  sx={{ mt: '45px' }}
                  id="menu-appbar"
                  anchorEl={anchorElUser}
                  anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  keepMounted
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                  }}
                  open={Boolean(anchorElUser)}
                  onClose={handleCloseUserMenu}
                >
                  {menuOptions.map((option) => (
                    <MenuItem
                      key={option.name}
                      onClick={() => {
                        return option.handler() && handleCloseUserMenu()
                      }}
                    >
                      <Typography textAlign="center">{option.name}</Typography>
                    </MenuItem>
                  ))}
                </Menu>
              </Box>
            )}
          </Toolbar>
        </AppBar>
      )}
      {page !== '/login' && (
        <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }} aria-label="page navigation">
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better open performance on mobile.
            }}
            sx={{
              display: { xs: 'block', sm: 'none' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
          >
            {drawer}
          </Drawer>
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', sm: 'block' },
              '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
            }}
            open
          >
            {drawer}
          </Drawer>
        </Box>
      )}
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar />
        {React.cloneElement(children, { authenticated, searchText })}
      </Box>
    </Box>
  )
}

export default Navbar20
