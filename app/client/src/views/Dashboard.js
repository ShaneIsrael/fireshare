import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import Navbar from '../components/nav/Navbar'
import { AuthService } from '../services'

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    async function isLoggedIn() {
      try {
        if (!(await AuthService.isLoggedIn()).data) {
          navigate('/login')
        } else {
          setAuthenticated(true)
        }
      } catch (err) {
        console.log(err)
      }
    }
    isLoggedIn()
  }, [navigate])

  if (!authenticated) return null

  const logoutHandler = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <Navbar>
      <Box component="main">
        <Paper square sx={{ overflow: 'auto' }}>
          <Grid
            sx={{ height: 'calc(100vh - 64px)' }}
            container
            direction="row"
            justifyContent="center"
            alignItems="center"
          >
            <Grid container item justifyContent="center" spacing={2}>
              <Grid item xs={12}>
                <Typography variant="h3" align="center">
                  You are currently logged in
                </Typography>
              </Grid>
              <Grid item>
                <Button variant="contained" size="large" onClick={logoutHandler}>
                  Logout
                </Button>
              </Grid>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Navbar>
  )
}

export default Dashboard
