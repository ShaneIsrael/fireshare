import React from 'react'
import { Box, Grid, Typography, Divider, ToggleButtonGroup, ToggleButton } from '@mui/material'
import { useLocation, useNavigate } from 'react-router-dom'
import AppsIcon from '@mui/icons-material/Apps'
import { isMobile } from 'react-device-detect'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { AuthService, VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSetting, getSettings, setSetting } from '../common/utils'

import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'

import selectTheme from '../common/reactSelectTheme'
import SliderWrapper from '../components/misc/SliderWrapper'
import Search from '../components/search/Search'

const settings = getSettings()

const createSelectFolders = (folders) => {
  return folders.map((f) => ({ value: f, label: f }))
}

function useQuery() {
  const { search } = useLocation()

  return React.useMemo(() => new URLSearchParams(search), [search])
}

const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2

const Feed = () => {
  const query = useQuery()
  const category = query.get('category')
  const [authenticated, setAuthenticated] = React.useState(false)
  const [videos, setVideos] = React.useState([])
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)
  const [selectedFolder, setSelectedFolder] = React.useState(
    category
      ? { value: category, label: category }
      : getSetting('folder') || { value: 'All Videos', label: 'All Videos' },
  )
  const [alert, setAlert] = React.useState({ open: false })

  const [listStyle, setListStyle] = React.useState(settings?.listStyle || 'card')
  const navigate = useNavigate()

  function fetchVideos() {
    VideoService.getPublicVideos()
      .then((res) => {
        setVideos(res.data.videos)
        setFilteredVideos(res.data.videos)
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
          setAuthenticated(false)
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
    if ('URLSearchParams' in window) {
      const searchParams = new URLSearchParams('')
      searchParams.set('category', folder.value)
      window.history.replaceState({ category: folder.value }, '', `/#/feed?${searchParams.toString()}`)
    }
  }

  const handleCardSizeChange = (e, value) => {
    const modifier = value / 100
    const newSize = CARD_SIZE_DEFAULT * CARD_SIZE_MULTIPLIER * modifier
    setCardSize(newSize)
    setSetting('cardSize', newSize)
  }

  const handleSearch = (search) => {
    setFilteredVideos(videos.filter((v) => v.info.title.search(new RegExp(search, 'i')) >= 0))
  }

  const options = [
    { name: authenticated ? 'Logout' : 'Login', handler: authenticated ? handleLogout : () => navigate('/login') },
  ]
  const pages = []
  if (authenticated) {
    pages.push({ name: 'Admin View', href: '/' })
    options.push({ name: 'Scan Library', handler: handleScan })
  }

  return (
    <Navbar options={options} pages={pages} feedView={true}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ overflow: 'auto', height: '100%' }}>
        <Grid sx={{}} container direction="row" justifyContent="center">
          <Grid container item justifyContent="center" spacing={2} sx={{ mt: 5 }}>
            <Grid item xs={12}>
              <Grid container sx={{ pr: 2, pl: 2 }}>
                <Grid item xs sx={{ display: { xs: 'flex', sm: 'none' } }}>
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
                    PUBLIC VIDEOS
                  </Typography>
                </Grid>
                <Grid item sx={{ display: { xs: 'none', sm: 'flex' } }}>
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
                    PUBLIC VIDEOS
                  </Typography>
                </Grid>
                <Grid item xs sx={{ display: { xs: 'none', sm: 'flex' } }}>
                  <Search
                    placeholder={`Search ${selectedFolder.label}`}
                    searchHandler={handleSearch}
                    sx={{ pl: 4, pr: 4, width: '100%' }}
                  />
                </Grid>
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
                {videos && videos.length !== 0 && (
                  <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 3 }}>
                    <Select
                      value={selectedFolder}
                      options={createSelectFolders(folders)}
                      onChange={handleFolderSelection}
                      styles={selectTheme}
                      blurInputOnSelect
                      isSearchable={false}
                    />
                    <Search
                      placeholder={`Search ${selectedFolder.label}`}
                      searchHandler={(search) => console.log(search)}
                      sx={{ width: '100%', mt: 1, display: { xs: 'flex', sm: 'none' } }}
                    />
                  </Grid>
                )}
                <Grid item xs={12}>
                  {listStyle === 'list' && (
                    <VideoList
                      authenticated={authenticated}
                      loadingIcon={loading ? <LoadingSpinner /> : null}
                      feedView
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
                      feedView={true}
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

export default Feed
