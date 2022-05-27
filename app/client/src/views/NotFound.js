import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services'
import Navbar from '../components/nav/Navbar'
import { Box, Grid, Paper, Typography } from '@mui/material'

const NotFound = ({ title, body }) => {
  const [loggedIn, setLoggedIn] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    try {
      async function isLoggedIn() {
        setLoggedIn((await AuthService.isLoggedIn()).data)
      }
      isLoggedIn()
    } catch (err) {
      console.error(err)
    }
  }, [])

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }
  const handleLogin = async () => {
    try {
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const options = [{ name: loggedIn ? 'Logout' : 'Login', handler: loggedIn ? handleLogout : handleLogin }]

  return (
    <Navbar options={options}>
      <Paper square sx={{ overflow: 'auto' }}>
        <Grid
          sx={{ height: 'calc(100vh - 65px)' }}
          container
          direction="row"
          justifyContent="center"
          alignItems="center"
        >
          <Grid item>
            <Typography align="center" variant="h1">
              {title || '404'}
            </Typography>
            <Typography align="center" variant="h3">
              {body || 'Page Not Found'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Navbar>
  )
}

export default NotFound
