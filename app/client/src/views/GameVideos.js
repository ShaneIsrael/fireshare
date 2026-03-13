import React from 'react'
import ReactDOM from 'react-dom'
import { Box } from '@mui/material'
import { useParams } from 'react-router-dom'
import Select from 'react-select'
import { GameService } from '../services'
import VideoCards from '../components/cards/VideoCards'
import GameVideosHeader from '../components/game/GameVideosHeader'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { SORT_OPTIONS } from '../common/constants'
import selectSortTheme from '../common/reactSelectSortTheme'

const GameVideos = ({ cardSize, authenticated, searchText }) => {
  const { gameId } = useParams()
  const [videos, setVideos] = React.useState([])
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [game, setGame] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [toolbarTarget, setToolbarTarget] = React.useState(null)

  // Filter videos when searchText changes
  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info?.title?.search(new RegExp(searchText, 'i')) >= 0))
  }

  React.useEffect(() => {
    Promise.all([GameService.getGames(), GameService.getGameVideos(gameId)])
      .then(([gamesRes, videosRes]) => {
        const foundGame = gamesRes.data.find((g) => g.steamgriddb_id === parseInt(gameId))
        setGame(foundGame)
        const fetchedVideos = videosRes.data || []
        setVideos(fetchedVideos)
        setFilteredVideos(fetchedVideos)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching game videos:', err)
        setLoading(false)
      })
  }, [gameId])

  React.useEffect(() => {
    setToolbarTarget(document.getElementById('navbar-toolbar-extra'))
  }, [])

  const sortedVideos = React.useMemo(() => {
    if (!filteredVideos || !Array.isArray(filteredVideos)) return []
    return [...filteredVideos].sort((a, b) => {
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
  }, [filteredVideos, sortOrder])

  if (loading) return <LoadingSpinner />

  return (
    <Box>
      {toolbarTarget &&
        ReactDOM.createPortal(
          <Box sx={{ minWidth: { xs: 120, sm: 150 } }}>
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
      <GameVideosHeader game={game} />
      <Box sx={{ p: 3 }}>
        <VideoCards videos={sortedVideos} authenticated={authenticated} size={cardSize} feedView={false} />
      </Box>
    </Box>
  )
}

export default GameVideos
