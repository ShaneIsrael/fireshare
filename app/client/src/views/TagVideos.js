import React from 'react'
import ReactDOM from 'react-dom'
import { Box, Typography } from '@mui/material'
import { useParams } from 'react-router-dom'
import Select from 'react-select'
import { TagService } from '../services'
import VideoCards from '../components/cards/VideoCards'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { SORT_OPTIONS } from '../common/constants'
import { sortSelectTheme as selectSortTheme } from '../common/reactSelectThemes'

const TagVideos = ({ cardSize, authenticated, searchText }) => {
  const { tagId } = useParams()
  const [videos, setVideos] = React.useState([])
  const [filteredVideos, setFilteredVideos] = React.useState([])
  const [search, setSearch] = React.useState(searchText)
  const [tag, setTag] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [sortOrder, setSortOrder] = React.useState(SORT_OPTIONS?.[0] || { value: 'newest', label: 'Newest' })
  const [toolbarTarget, setToolbarTarget] = React.useState(null)
  const [currentClipIndex, setCurrentClipIndex] = React.useState(0)
  const videoRefs = React.useRef([])

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

  const clips = React.useMemo(
    () =>
      videos
        .filter((v) => (v.info?.duration || 0) >= 5)
        .slice(0, 6)
        .map((v) => `/api/video/poster?id=${v.video_id}&animated=true`),
    [videos],
  )

  React.useEffect(() => {
    if (clips.length <= 1) return
    const timer = setInterval(() => {
      setCurrentClipIndex((i) => (i + 1) % clips.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [clips.length])

  React.useEffect(() => {
    videoRefs.current.forEach((v) => {
      if (v) v.play().catch(() => {})
    })
  }, [clips])

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
    <>
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
      <Box>
      {/* Tag hero banner */}
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: 200,
          overflow: 'hidden',
          mb: 3,
          bgcolor: '#0A1929',
        }}
      >
        {/* Video clips cycling in background */}
        {clips.map((src, i) => (
          <Box
            key={src}
            component="video"
            ref={(el) => {
              videoRefs.current[i] = el
            }}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            onLoadedMetadata={(e) => {
              e.target.currentTime = (e.target.duration / clips.length) * i
            }}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              opacity: i === currentClipIndex ? 0.45 : 0,
              transition: 'opacity 1.5s ease',
              pointerEvents: 'none',
            }}
          />
        ))}

        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, #00000066 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        {/* Solid color multiply overlay */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: color,
            mixBlendMode: 'multiply',
            opacity: 1,
            pointerEvents: 'none',
          }}
        />

        {/* Tag name - bottom left */}
        <Box
          sx={{
            position: 'relative',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            px: 3,
          }}
        >
          <Typography
            sx={{
              fontSize: 11,
              fontWeight: 700,
              color: '#999',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              mb: 0.5,
            }}
          >
            Tag
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: 36, sm: 52 },
              color: 'white',
              letterSpacing: '-0.5px',
              lineHeight: 1,
              fontFamily: '"Montserrat",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
            }}
          >
            {(tag?.name || 'Tag').replace(/_/g, ' ')}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ p: 3 }}>
        <VideoCards videos={sortedVideos} authenticated={authenticated} size={cardSize} feedView={false} />
      </Box>
      </Box>
    </>
  )
}

export default TagVideos
