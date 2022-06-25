import React from 'react'
import { Box, Grid, Typography, Divider, ToggleButtonGroup, ToggleButton, Stack } from '@mui/material'
import AppsIcon from '@mui/icons-material/Apps'
import TableRowsIcon from '@mui/icons-material/TableRows'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import Navbar from '../components/nav/Navbar'
import { VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSetting, getSettings, setSetting } from '../common/utils'
import { isMobile } from 'react-device-detect'
import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'

import selectFolderTheme from '../common/reactSelectFolderTheme'
import selectSortTheme from '../common/reactSelectSortTheme'
import SliderWrapper from '../components/misc/SliderWrapper'
import Search from '../components/search/Search'
import { SORT_OPTIONS } from '../common/constants'

const settings = getSettings()

const createSelectFolders = (folders) => {
  return folders.map((f) => ({ value: f, label: f }))
}

const CARD_SIZE_DEFAULT = 375
const CARD_SIZE_MULTIPLIER = 2

const Dashboard = ({ authenticated, searchText }) => {
  const [videos, setVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [cardSize, setCardSize] = React.useState(getSetting('cardSize') || CARD_SIZE_DEFAULT)
  const [selectedFolder, setSelectedFolder] = React.useState(
    getSetting('folder') || { value: 'All Videos', label: 'All Videos' },
  )
  const [selectedSort, setSelectedSort] = React.useState(SORT_OPTIONS[0])

  const [alert, setAlert] = React.useState({ open: false })

  const [listStyle, setListStyle] = React.useState(settings?.listStyle || 'card')

  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info.title.search(new RegExp(searchText, 'i')) >= 0))
  }

  function fetchVideos() {
    VideoService.getVideos(selectedSort.value)
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
    fetchVideos()
    // eslint-disable-next-line
  }, [selectedSort])

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

  const pages = [{ name: 'View Feed', href: '/feed' }]
  return (
    // <Navbar pages={pages} authenticated={authenticated}>
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <Box sx={{ height: '100%' }}>
        <Grid container item justifyContent="center" spacing={2}>
          <Grid item xs={12}>
            <Grid container sx={{ pr: 2, pl: 2, mb: 2 }}>
              <Grid item xs sx={{ display: { xs: 'flex', sm: 'none' } }} />
              <Grid item xs sx={{ display: { xs: 'none', sm: 'flex' } }} />

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
            <Grid container justifyContent="center">
              <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 2 }}>
                <Stack direction="row" spacing={1}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Select
                      value={selectedFolder}
                      options={createSelectFolders(folders)}
                      onChange={handleFolderSelection}
                      styles={selectFolderTheme}
                      blurInputOnSelect
                      isSearchable={false}
                    />
                  </Box>
                  <Select
                    value={selectedSort}
                    options={SORT_OPTIONS}
                    onChange={(option) => setSelectedSort(option)}
                    styles={selectSortTheme}
                    blurInputOnSelect
                    isSearchable={false}
                  />
                </Stack>
              </Grid>
            </Grid>
            <Box>
              {listStyle === 'list' && (
                <VideoList
                  authenticated={authenticated}
                  loadingIcon={loading ? <LoadingSpinner /> : null}
                  videos={
                    selectedFolder.value === 'All Videos'
                      ? filteredVideos
                      : filteredVideos?.filter(
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
                      ? filteredVideos
                      : filteredVideos?.filter(
                          (v) =>
                            v.path
                              .split('/')
                              .slice(0, -1)
                              .filter((f) => f !== '')[0] === selectedFolder.value,
                        )
                  }
                />
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
    // </Navbar>
  )
}

export default Dashboard
