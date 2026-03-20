import React from 'react'
import ReactDOM from 'react-dom'
import { Box, Typography } from '@mui/material'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import { useParams } from 'react-router-dom'
import Select from 'react-select'
import { TagService } from '../services'
import VideoCards from '../components/cards/VideoCards'
import LoadingSpinner from '../components/misc/LoadingSpinner'
import { SORT_OPTIONS } from '../common/constants'
import selectSortTheme from '../common/reactSelectSortTheme'

const TagVideos = ({ cardSize, authenticated, searchText }) => {
  const { tagId } = useParams()
  const [videos, setVideos] = React.useState([])
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [tag, setTag] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [toolbarTarget, setToolbarTarget] = React.useState(null)

  if (searchText !== search) {
    setSearch(searchText)
    setFilteredVideos(videos.filter((v) => v.info?.title?.search(new RegExp(searchText, 'i')) >= 0))
  }

  React.useEffect(() => {
    Promise.all([TagService.getTags(), TagService.getTagVideos(tagId)])
      .then(([tagsRes, videosRes]) => {
        const foundTag = tagsRes.data.find((t) => t.id === parseInt(tagId))
        setTag(foundTag || null)
        const fetchedVideos = videosRes.data || []
        setVideos(fetchedVideos)
        setFilteredVideos(fetchedVideos)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Error fetching tag videos:', err)
        setLoading(false)
      })
  }, [tagId])

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

  const color = tag?.color || '#2684FF'

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

      {/* Tag header */}
      <Box
        sx={{
          px: 3,
          pt: 3,
          pb: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <LocalOfferIcon sx={{ color, fontSize: 28 }} />
        <Typography sx={{ fontWeight: 700, fontSize: 24, color: 'white' }}>
          {(tag?.name || 'Tag').replace(/_/g, ' ')}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#FFFFFF55', ml: 1 }}>
          {sortedVideos.length} video{sortedVideos.length !== 1 ? 's' : ''}
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        <VideoCards videos={sortedVideos} authenticated={authenticated} size={cardSize} feedView={false} />
      </Box>
    </Box>
  )
}

export default TagVideos
