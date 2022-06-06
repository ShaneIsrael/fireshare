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
import Tooltip, { tooltipClasses } from '@mui/material/Tooltip'
import MenuItem from '@mui/material/MenuItem'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import GitHubIcon from '@mui/icons-material/GitHub'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import BugReportIcon from '@mui/icons-material/BugReport'
import { lightBlue } from '@mui/material/colors'

import logo from '../../assets/logo.png'
import { Paper, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import styled from '@emotion/styled'

const LightTooltip = styled(({ className, ...props }) => <Tooltip {...props} classes={{ popper: className }} />)(
  ({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
      backgroundColor: '#ffffff',
      color: 'rgba(0, 0, 0, 0.87)',
      boxShadow: theme.shadows[1],
      fontSize: 11,
    },
  }),
)

const Navbar = ({ children, options, pages = [], feedView = false }) => {
  const [anchorElNav, setAnchorElNav] = React.useState(null)
  const [anchorElUser, setAnchorElUser] = React.useState(null)
  const navigate = useNavigate()

  const handleFileUpload = (event) => {}
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
            onClick={() => navigate(feedView ? '/feed' : '/')}
            sx={{
              mr: 2,
              cursor: 'pointer',
              display: { xs: 'none', sm: 'flex' },
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
            <Box sx={{ flexGrow: 1, display: { xs: 'flex', sm: 'none', md: 'none' } }}>
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
                  <MenuItem
                    key={page.name}
                    onClick={() => {
                      return navigate(page.href)
                    }}
                  >
                    <Typography textAlign="center">{page.name}</Typography>
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
          <Box sx={{ flexGrow: 1, display: { xs: 'none', sm: 'flex' } }}>
            {pages.map((page) => (
              <Button
                key={page.name}
                onClick={() => {
                  return navigate(page.href)
                }}
                sx={{ my: 2, color: 'white', display: 'block' }}
              >
                {page.name}
              </Button>
            ))}
          </Box>
	  <Box sx={{ flexGrow: 0 }}>
		<Tooltip title="Upload">
		 <IconButton onClick={} sx={{ p:0 }}>
		  <Avatar alt="Upload" sx={{ bgcolor: lightBlue[500] }}>
		   <CloudUploadIcon />
		  </Avatar>
		 </IconButton>
		</Tooltip>
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
      <Box sx={{ pointerEvents: 'none', position: 'fixed', left: 0, bottom: 0, width: '100%' }}>
        <Paper
          square
          elevation={0}
          sx={{
            height: 35,
            width: '100%',
            borderRight: 0,
            borderLeft: 0,
            background: 'rgba(0, 0, 0, 0.13)',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ pt: '1px' }} spacing={3}>
            <LightTooltip arrow title="Found a bug? Report it here.">
              <IconButton
                aria-label="report-bug-link"
                size="medium"
                sx={{ p: 0.5, pointerEvents: 'all' }}
                onClick={() => window.open('https://github.com/ShaneIsrael/fireshare/issues', '_blank')}
              >
                <BugReportIcon fontSize="inherit" />
              </IconButton>
            </LightTooltip>
            <LightTooltip arrow title="View Fireshare on Github">
              <IconButton
                aria-label="github-link"
                size="medium"
                sx={{ p: 0.5, pointerEvents: 'all' }}
                onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
              >
                <GitHubIcon fontSize="inherit" />
              </IconButton>
            </LightTooltip>
            <LightTooltip arrow title="Buy us a coffee!">
              <IconButton
                aria-label="paypal-link"
                size="medium"
                sx={{ p: 0.5, pointerEvents: 'all' }}
                onClick={() => window.open('https://www.paypal.com/paypalme/shaneisrael', '_blank')}
              >
                <VolunteerActivismIcon fontSize="inherit" />
              </IconButton>
            </LightTooltip>
          </Stack>
        </Paper>
      </Box>
    </>
  )
}
export default Navbar
