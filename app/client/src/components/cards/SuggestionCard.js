import React from 'react'
import { Box, Skeleton, Typography } from '@mui/material'
import { getPosterUrl, toHHMMSS } from '../../common/utils'

const SuggestionCard = ({ video, onSelect }) => {
  const [imgLoaded, setImgLoaded] = React.useState(false)

  const title = video.info?.title || 'Untitled'
  const duration = video.info?.duration
  const gameName = video.game?.name || null
  const recordedAt = video.recorded_at
    ? new Date(video.recorded_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  return (
    <Box
      onClick={() => onSelect?.(video.video_id)}
      sx={{
        display: 'flex',
        gap: 1.5,
        p: 1,
        borderRadius: '8px',
        cursor: 'pointer',
        bgcolor: 'transparent',
        transition: 'background 0.15s ease',
        alignItems: 'flex-start',
        '&:hover': { bgcolor: '#FFFFFF0D' },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          flexShrink: 0,
          width: 96,
          borderRadius: '6px',
          overflow: 'hidden',
          aspectRatio: '16 / 9',
          bgcolor: '#FFFFFF08',
        }}
      >
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: imgLoaded ? 0 : 1,
            transition: 'opacity 0.25s ease',
            bgcolor: '#1E3C8266',
          }}
        />
        <img
          src={getPosterUrl(video.video_id)}
          alt=""
          loading="lazy"
          onLoad={() => setImgLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.25s ease',
          }}
        />
        {duration > 0 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              bgcolor: '#000000BF',
              borderRadius: '3px',
              px: 0.5,
              py: 0.1,
              lineHeight: 1,
            }}
          >
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'white' }}>
              {toHHMMSS(duration)}
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
        <Typography
          sx={{
            fontSize: 13,
            fontWeight: 600,
            color: 'white',
            lineHeight: 1.35,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            mb: 0.5,
          }}
        >
          {title}
        </Typography>
        {gameName && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
            {video.game?.icon_url && (
              <img
                src={video.game.icon_url}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
                style={{ width: 14, height: 14, objectFit: 'contain', borderRadius: 2, flexShrink: 0 }}
              />
            )}
            <Typography
              sx={{
                fontSize: 12,
                color: '#FFFFFFB3',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {gameName}
            </Typography>
          </Box>
        )}
        {recordedAt && (
          <Typography sx={{ fontSize: 12, color: '#FFFFFF66' }}>
            {recordedAt}
          </Typography>
        )}
      </Box>
    </Box>
  )
}

export default SuggestionCard
