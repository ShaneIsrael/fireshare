import React from 'react'
import { Box, Grid, Typography, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AppsIcon from '@mui/icons-material/Apps'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { AuthService, VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSetting, getSettings, setSetting } from '../common/utils'
import { isMobile } from 'react-device-detect'
import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'
import UploadModal from '../components/modal/UploadModal'

import selectTheme from '../common/reactSelectTheme'
import SliderWrapper from '../components/misc/SliderWrapper'

const settings = getSettings()

const createSelectFolders = (folders) => {
  return folders.map((f) => ({ value: f, label: f }))
}

const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const [videos, setVideos] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)
  const [selectedFolder, setSelectedFolder] = React.useState(
    getSetting('folder') || { value: 'All Videos', label: 'All Videos' },
  )
  const [alert, setAlert] = React.useState({ open: false })

  const [listStyle, setListStyle] = React.useState(settings?.listStyle || 'card')
  const navigate = useNavigate()

  function fetchVideos() {
    VideoService.getVideos()
      .then((res) => {
        setVideos(res.data.videos)
        const tfolders = []
        res.data.videos.forEach((v) => {
          const split = v.path
            .split('/')
            .slice(0, -1)
            .filter((f) => f !== '')
          if (split.length > 0 && !tfolders.includes(split[0])) {
            tfolders.push(split[0])
          }
        })
        tfolders.sort((a, b) => (a.toLowerCase() > b.toLowerCase() ? 1 : -1)).unshift('All Videos')
        setFolders(tfolders)
        setLoading(false)
      })
      .catch((err) => {
        setLoading(false)
        setAlert({
          open: true,
          type: 'error',
          message: err.response?.data || 'Unknown Error',
        })
        console.log(err)
      })
  }

  React.useEffect(() => {
    try {
      async function isLoggedIn() {
        if (!(await AuthService.isLoggedIn()).data) {
          navigate('/feed')
        } else {
          setAuthenticated(true)
        }
      }
      isLoggedIn()
    } catch (err) {
      console.error(err)
    }
    fetchVideos()
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

  const handleListStyleChange = (e, style) => {
    if (style !== null) {
      setListStyle(style)
      setSetting('listStyle', style)
      fetchVideos()
    }
  }

  const handleFolderSelection = (folder) => {
    setSetting('folder', folder)
    setSelectedFolder(folder)
  }

  const handleCardSizeChange = (e, value) => {
    const modifier = value / 100
    const newSize = CARD_SIZE_DEFAULT * CARD_SIZE_MULTIPLIER * modifier
    setCardSize(newSize)
    setSetting('cardSize', newSize)
  }

  const options = [
    { name: 'Logout', handler: handleLogout },
    { name: 'Scan Library', handler: handleScan },
  ]
  const pages = [{ name: 'View Feed', href: '/feed' }]
  return (
    <Navbar options={options} pages={pages}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ overflow: 'auto', height: '100%' }}>
        <Grid sx={{}} container direction="row" justifyContent="center">
          <Grid container item justifyContent="center" spacing={2} sx={{ mt: 5 }}>
            <Grid item xs={12}>
              <Grid container sx={{ pr: 2, pl: 2 }}>
                <Grid item xs>
                  <Typography
                    variant="h5"
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
                {authenticated && <UploadModal folders={folders} />}
                {!isMobile && (
                  <Grid item sx={{ pr: 2, pt: 0.25 }}>
                    <SliderWrapper
                      width={100}
                      cardSize={cardSize}
                      defaultCardSize={CARD_SIZE_DEFAULT}
                      cardSizeMultiplier={CARD_SIZE_MULTIPLIER}
                      onChangeCommitted={handleCardSizeChange}
                    />
                  </Grid>
                )}

                <Grid item>
                  <ToggleButtonGroup
                    size="small"
                    sx={{ mt: -0.5 }}
                    value={listStyle}
                    exclusive
                    onChange={handleListStyleChange}
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
              <Grid container justifyContent="center">
                <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 3 }}>
                  <Select
                    value={selectedFolder}
                    options={createSelectFolders(folders)}
                    onChange={handleFolderSelection}
                    styles={selectTheme}
                    blurInputOnSelect
                    isSearchable={false}
                  />
                </Grid>
                <Grid item xs={12}>
                  {listStyle === 'list' && (
                    <VideoList
                      authenticated={authenticated}
                      loadingIcon={loading ? <LoadingSpinner /> : null}
                      videos={
                        selectedFolder.value === 'All Videos'
                          ? videos
                          : videos?.filter(
                            (v) =>
                              v.path
                                .split('/')
                                .slice(0, -1)
                                .filter((f) => f !== '')[0] === selectedFolder.value,
                          )
                      }
                    />
                  )}
                  {listStyle === 'card' && (
                    <VideoCards
                      authenticated={authenticated}
                      loadingIcon={loading ? <LoadingSpinner /> : null}
                      size={cardSize}
                      videos={
                        selectedFolder.value === 'All Videos'
                          ? videos
                          : videos?.filter(
                            (v) =>
                              v.path
                                .split('/')
                                .slice(0, -1)
                                .filter((f) => f !== '')[0] === selectedFolder.value,
                          )
                      }
                    />
                  )}
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>
    </Navbar>
  )
}

export default Dashboard
