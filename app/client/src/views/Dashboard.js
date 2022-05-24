import { Box, Button, Grid, Paper, Typography } from '@mui/material'
import React from 'react'
import { useNavigate } from 'react-router-dom'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { AuthService, VideoService } from '../services'

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [videos, setVideos] = React.useState(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    try {
      async function isLoggedIn() {
        if (!(await AuthService.isLoggedIn()).data) {
          navigate('/login')
        } else {
          setAuthenticated(true)
        }
      }
      async function fetchVideos() {
        const res = (await VideoService.getVideos()).data
        setVideos(res.videos)
      }
      isLoggedIn()
      fetchVideos()
    } catch (err) {
      console.error(err)
    }
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
          <Grid sx={{ height: 'calc(100vh - 64px)' }} container direction="row" justifyContent="center">
            <Grid container item justifyContent="center" spacing={2} sx={{ mt: 10 }}>
              <Grid item xs={10}>
                <VideoList videos={videos} />
              </Grid>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Navbar>
  )
}

export default Dashboard
