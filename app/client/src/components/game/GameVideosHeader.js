import React from 'react'
import { Box, IconButton } from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'

const GameVideosHeader = ({ game, height = 200, cacheBust, editMode, onEditAssets }) => {
  const bgUrl = game?.steamgriddb_id
    ? `/api/game/assets/${game.steamgriddb_id}/hero_2.png?fallback=hero_1${cacheBust ? `&v=${cacheBust}` : ''}`
    : null

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        mb: 3,
      }}
    >
    {bgUrl && (
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${bgUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.7,
          pointerEvents: 'none',
        }}
      />
    )}
    <Box
      sx={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        justifyContent: { xs: 'center', sm: 'flex-start' },
        alignItems: 'center',
        px: 3,
      }}
    >
      {game?.logo_url && (
        <Box
          component="img"
          src={game.logo_url}
          sx={{
            maxHeight: 80,
            maxWidth: 300,
            objectFit: 'contain',
          }}
        />
      )}
      {editMode && game && (
        <IconButton
          size="small"
          onClick={onEditAssets}
          sx={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            bgcolor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            '&:hover': { bgcolor: 'rgba(0,0,0,0.85)' },
          }}
        >
          <ImageIcon />
        </IconButton>
      )}
    </Box>
  </Box>
  )
}

export default GameVideosHeader
