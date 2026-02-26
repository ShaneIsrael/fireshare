import React from 'react'
import ReactDOM from 'react-dom'
import { Box, Grid } from '@mui/material'
import { useLocation } from 'react-router-dom'
import VideoCards from '../components/admin/VideoCards'
import VideoList from '../components/admin/VideoList'
import { VideoService } from '../services'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { getSetting, setSetting } from '../common/utils'

import Select from 'react-select'
import SnackbarAlert from '../components/alert/SnackbarAlert'

import selectFolderTheme from '../common/reactSelectFolderTheme'
import selectSortTheme from '../common/reactSelectSortTheme'
import { SORT_OPTIONS } from '../common/constants'

const createSelectFolders = (folders) => {
  return folders.map((f) => ({ value: f, label: f }))
}

function useQuery() {
  const { search } = useLocation()

  return React.useMemo(() => new URLSearchParams(search), [search])
}

const Feed = ({ authenticated, searchText, cardSize, listStyle }) => {
  const query = useQuery()
  const category = query.get('category')
  const [videos, setVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [folders, setFolders] = React.useState(['All Videos'])
  const [selectedFolder, setSelectedFolder] = React.useState(
    category
      ? { value: category, label: category }
      : getSetting('folder') || { value: 'All Videos', label: 'All Videos' },
  )
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })

  const [alert, setAlert] = React.useState({ open: false })

  const [prevCardSize, setPrevCardSize] = React.useState(cardSize)
  const [prevListStyle, setPrevListStyle] = React.useState(listStyle)
  const [toolbarTarget, setToolbarTarget] = React.useState(null)

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info.title.search(new RegExp(searchText, 'i')) >= 0))
  }
  if (cardSize !== prevCardSize) {
    setPrevCardSize(cardSize)
  }
  if (listStyle !== prevListStyle) {
    setPrevListStyle(listStyle)
  }

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
          message: typeof err.response?.data === 'string' ? err.response.data : 'Unknown Error',
        })
        console.log(err)
      })
  }

  React.useEffect(() => {
    fetchVideos()
    // eslint-disable-next-line
  }, [])

  const handleFolderSelection = (folder) => {
    setSetting('folder', folder)
    setSelectedFolder(folder)
    if ('URLSearchParams' in window) {
      const searchParams = new URLSearchParams('')
      searchParams.set('category', folder.value)
      window.history.replaceState({ category: folder.value }, '', `/#/feed?${searchParams.toString()}`)
    }
  }

  // Get the filtered videos based on folder selection
  const displayVideos = React.useMemo(() => {
    if (selectedFolder.value === 'All Videos') {
      return filteredVideos
    }
    return filteredVideos?.filter(
      (v) =>
        v.path
          .split('/')
          .slice(0, -1)
          .filter((f) => f !== '')[0] === selectedFolder.value,
    )
  }, [filteredVideos, selectedFolder])

  // Check if date grouping should be shown
  const showDateGroups = getSetting('ui_config')?.show_date_groups !== false
  const isSortingByViews = sortOrder.value === 'most_views' || sortOrder.value === 'least_views'
  const skipDateGrouping = isSortingByViews || !showDateGroups

  // Sort videos by recorded date or views
  const sortedVideos = React.useMemo(() => {
    if (!displayVideos) return []

    return [...displayVideos].sort((a, b) => {
      if (sortOrder.value === 'most_views') {
        return (b.view_count || 0) - (a.view_count || 0)
      } else if (sortOrder.value === 'least_views') {
        return (a.view_count || 0) - (b.view_count || 0)
      } else {
        const dateA = a.recorded_at ? new Date(a.recorded_at) : new Date(0)
        const dateB = b.recorded_at ? new Date(b.recorded_at) : new Date(0)
        return sortOrder.value === 'newest' ? dateB - dateA : dateA - dateB
      }
    })
  }, [displayVideos, sortOrder])

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      {toolbarTarget && ReactDOM.createPortal(
        <Box sx={{ minWidth: 200 }}>
          <Select
            value={sortOrder}
            options={SORT_OPTIONS}
            onChange={setSortOrder}
            styles={selectSortTheme}
            menuPortalTarget={document.body}
            menuPosition="fixed"
            blurInputOnSelect
            isSearchable={false}
          />
        </Box>,
        toolbarTarget,
      )}
      <Box sx={{ height: '100%' }}>
        <Grid container item justifyContent="center">
          <Grid item xs={12}>
            <Grid container justifyContent="center">
              <Grid item xs={11} sm={9} md={7} lg={5} sx={{ mb: 2 }}>
                <Select
                  value={selectedFolder}
                  options={createSelectFolders(folders)}
                  onChange={handleFolderSelection}
                  styles={selectFolderTheme}
                  blurInputOnSelect
                  isSearchable={false}
                />
              </Grid>
            </Grid>
            <Box>
              {listStyle === 'list' && (
                <VideoList
                  authenticated={authenticated}
                  loadingIcon={loading ? <LoadingSpinner /> : null}
                  feedView
                  videos={displayVideos}
                />
              )}
              {listStyle === 'card' && (
                <Box sx={{ px: 1 }}>
                  {loading && <LoadingSpinner />}
                  {!loading && (
                    <VideoCards
                      videos={sortedVideos}
                      authenticated={authenticated}
                      feedView={true}
                      size={cardSize}
                      showUploadCard={selectedFolder.value === 'All Videos'}
                      showDateHeaders={!skipDateGrouping}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Grid>
        </Grid>
      </Box>
    </>
  )
}

export default Feed
