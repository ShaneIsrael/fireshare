import React from 'react'
import { Box, Grid, Paper, Typography, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AppsIcon from '@mui/icons-material/Apps'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { AuthService, VideoService } from '../services'

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [videos, setVideos] = React.useState(null)
  const [listStyle, setListStyle] = React.useState('card')
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

  const handleLogout = async () => {
    try {
      await AuthService.logout()
      navigate('/login')
    } catch (err) {
      console.error(err)
    }
  }

  const options = [{ name: 'Logout', handler: handleLogout }]

  return (
    <Navbar options={options}>
      <Box component="main">
        <Paper square sx={{ overflow: 'auto' }}>
          <Grid sx={{ height: 'calc(100vh - 64px)' }} container direction="row" justifyContent="center">
            <Grid container item justifyContent="center" spacing={2} sx={{ mt: 10 }}>
              <Grid item xs={11}>
                <Grid container>
                  <Grid item xs>
                    <Typography
                      variant="h4"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: 500,
                        letterSpacing: '.2rem',
                        color: 'inherit',
                        textDecoration: 'none',
                        ml: 1,
                      }}
                    >
                      MY VIDEOS
                    </Typography>
                  </Grid>
                  <Grid item>
                    <ToggleButtonGroup
                      sx={{ mt: -1.5 }}
                      value={listStyle}
                      exclusive
                      onChange={(e, style) => style !== null && setListStyle(style)}
                    >
                      <ToggleButton value="card">
                        <AppsIcon />
                      </ToggleButton>
                      <ToggleButton value="list">
                        <TableRowsIcon />
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                </Grid>
                <Divider sx={{ mb: 2 }} light />
                {listStyle === 'list' && <VideoList videos={videos} />}
                {listStyle === 'card' && <VideoCards videos={videos} />}
              </Grid>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Navbar>
  )
}

export default Dashboard
