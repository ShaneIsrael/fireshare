import React from 'react'
import { Box, Grid, Paper, Typography, Divider, ToggleButtonGroup, ToggleButton, Tabs, Tab } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AppsIcon from '@mui/icons-material/Apps'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { AuthService, VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSettings, setSetting } from '../common/utils'

function TabPanel(props) {
  const { children, value, index, ...other } = props

  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}
const settings = getSettings()

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [videos, setVideos] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [tab, setTab] = React.useState(0)
  const [listStyle, setListStyle] = React.useState(settings?.listStyle || 'card')
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
        const tfolders = []
        res.videos.forEach((v) => {
          const split = v.path
            .split('/')
            .slice(0, -1)
            .filter((f) => f !== '')
          if (split.length > 0 && !tfolders.includes(split[0])) {
            tfolders.push(split[0])
          }
        })
        tfolders.sort().unshift('All Videos')
        setFolders(tfolders)
        setLoading(false)
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

  const handleScan = async () => {
    try {
      await VideoService.scan()
      console.log('scan completed')
    } catch (err) {
      console.error(err)
    }
  }

  const handleListStyleChange = (e, style) => {
    if (style !== null) {
      setListStyle(style)
      setSetting({ listStyle: style })
      console.log(style)
    }
  }

  const options = [
    { name: 'Logout', handler: handleLogout },
    { name: 'Scan', handler: handleScan },
  ]
  return (
    <Navbar options={options}>
      <Box component="main">
        <Paper square sx={{ overflow: 'auto' }}>
          <Grid sx={{ height: 'calc(100vh - 64px)' }} container direction="row" justifyContent="center">
            <Grid container item justifyContent="center" spacing={2} sx={{ mt: 5 }}>
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
                    <ToggleButtonGroup sx={{ mt: -1.5 }} value={listStyle} exclusive onChange={handleListStyleChange}>
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
                <Grid container justifyContent="center">
                  <Box sx={{ maxWidth: { xs: 350, sm: 600, md: 1000 }, bgcolor: 'background.paper' }}>
                    <Tabs
                      value={tab}
                      onChange={(e, value) => setTab(value)}
                      variant="scrollable"
                      scrollButtons="auto"
                      aria-label="wrapped label tabs example"
                    >
                      {folders.map((f, i) => (
                        <Tab key={f} value={i} label={f} wrapped />
                      ))}
                    </Tabs>
                  </Box>
                  <Grid item xs={12}>
                    {folders.map((f, i) => (
                      <TabPanel key={f} value={tab} index={i}>
                        {listStyle === 'list' && (
                          <VideoList
                            loadingIcon={loading ? <LoadingSpinner /> : null}
                            videos={
                              i === 0
                                ? videos
                                : videos?.filter(
                                    (v) =>
                                      v.path
                                        .split('/')
                                        .slice(0, -1)
                                        .filter((f) => f !== '')[0] === f,
                                  )
                            }
                          />
                        )}
                        {listStyle === 'card' && (
                          <VideoCards
                            loadingIcon={loading ? <LoadingSpinner /> : null}
                            videos={
                              i === 0
                                ? videos
                                : videos?.filter(
                                    (v) =>
                                      v.path
                                        .split('/')
                                        .slice(0, -1)
                                        .filter((f) => f !== '')[0] === f,
                                  )
                            }
                          />
                        )}
                      </TabPanel>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Paper>
      </Box>
    </Navbar>
  )
}

export default Dashboard
