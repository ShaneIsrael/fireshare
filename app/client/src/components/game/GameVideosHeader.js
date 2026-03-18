import React from 'react'
import { Box } from '@mui/material'
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
    </Box>
    {editMode && game && (
      <Box
        onClick={onEditAssets}
        sx={{
          position: 'absolute',
          inset: 0,
          bgcolor: '#00000080',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          '&:hover': { bgcolor: '#000000A6' },
        }}
      >
        <ImageIcon sx={{ color: 'white', fontSize: 52, pointerEvents: 'none' }} />
      </Box>
    )}
  </Box>
  )
}

export default GameVideosHeader
