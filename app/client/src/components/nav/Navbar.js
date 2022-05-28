import * as React from 'react'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Toolbar from '@mui/material/Toolbar'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import Menu from '@mui/material/Menu'
import MenuIcon from '@mui/icons-material/Menu'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Tooltip from '@mui/material/Tooltip'
import MenuItem from '@mui/material/MenuItem'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import GitHubIcon from '@mui/icons-material/GitHub'
import { lightBlue } from '@mui/material/colors'

import logo from '../../assets/logo.png'
import { Paper, Stack } from '@mui/material'

const pages = []

const Navbar = ({ children, options }) => {
  const [anchorElNav, setAnchorElNav] = React.useState(null)
  const [anchorElUser, setAnchorElUser] = React.useState(null)

  const handleOpenNavMenu = (event) => {
    setAnchorElNav(event.currentTarget)
  }
  const handleOpenUserMenu = (event) => {
    setAnchorElUser(event.currentTarget)
  }

  const handleCloseNavMenu = () => {
    setAnchorElNav(null)
  }

  const handleCloseUserMenu = () => {
    setAnchorElUser(null)
  }

  return (
    <>
      <AppBar position="fixed" elevation={0} sx={{ height: 64, background: 'rgba(0, 0, 0, 0.13)' }}>
        <Toolbar>
          <Box
            component="img"
            src={logo}
            height={32}
            alt="fireshare logo"
            sx={{ display: { xs: 'none', sm: 'flex' }, mr: 1 }}
          />
          <Typography
            variant="div"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'none', sm: 'flex' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '.2rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            FIRESHARE
          </Typography>

          {pages.length > 0 && (
            <Box sx={{ flexGrow: 1, display: { xs: 'flex', md: 'none' } }}>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleOpenNavMenu}
                color="inherit"
              >
                <MenuIcon />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorElNav}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'left',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'left',
                }}
                open={Boolean(anchorElNav)}
                onClose={handleCloseNavMenu}
                sx={{
                  display: { xs: 'block', md: 'none' },
                }}
              >
                {pages.map((page) => (
                  <MenuItem key={page} onClick={handleCloseNavMenu}>
                    <Typography textAlign="center">{page}</Typography>
                  </MenuItem>
                ))}
              </Menu>
            </Box>
          )}
          <Box
            component="img"
            src={logo}
            height={32}
            alt="fireshare logo"
            sx={{ display: { xs: 'flex', sm: 'none' }, mr: 1 }}
          />
          <Typography
            variant="div"
            noWrap
            component="a"
            href="/"
            sx={{
              mr: 2,
              display: { xs: 'flex', sm: 'none' },
              flexGrow: 1,
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: 22,
              letterSpacing: '.2rem',
              color: 'inherit',
              textDecoration: 'none',
            }}
          >
            FIRESHARE
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'none', md: 'flex' } }}>
            {pages.map((page) => (
              <Button key={page} onClick={handleCloseNavMenu} sx={{ my: 2, color: 'white', display: 'block' }}>
                {page}
              </Button>
            ))}
          </Box>

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
              {options.map((option) => (
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
        </Toolbar>
      </AppBar>
      <Box
        component="main"
        sx={{
          mt: '64px',
          mb: '35px',
          height: 'calc(100vh - (64px + 35px))',
        }}
      >
        {children}
      </Box>
      <Box sx={{ position: 'fixed', left: 0, bottom: 0, width: '100%' }}>
        <Paper
          square
          elevation={0}
          sx={{ height: 35, width: '100%', borderRight: 0, borderLeft: 0, background: 'rgba(0, 0, 0, 0.13)' }}
        >
          <Stack direction="row" alignItems="center" justifyContent="center">
            <IconButton
              aria-label="github-link"
              size="medium"
              sx={{ p: 0, mt: 0.5 }}
              onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
            >
              <GitHubIcon fontSize="inherit" />
            </IconButton>
          </Stack>
        </Paper>
      </Box>
    </>
  )
}
export default Navbar
