import React from 'react'
import { Box, Skeleton } from '@mui/material'
import ImageIcon from '@mui/icons-material/Image'

const GameVideosHeader = ({ game, height = 200, editMode, onEditAssets }) => {
  const bgUrl = game?.banner_url || game?.hero_url || null
  const [imgLoaded, setImgLoaded] = React.useState(false)

  React.useEffect(() => {
    setImgLoaded(false)
  }, [bgUrl])

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        overflow: 'hidden',
        mb: 2,
      }}
    >
      {bgUrl && (
        <>
          <Skeleton
            variant="rectangular"
            animation="wave"
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: imgLoaded ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}
          />
          <Box
            component="img"
            src={bgUrl}
            onLoad={() => setImgLoaded(true)}
            sx={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              opacity: imgLoaded ? 0.7 : 0,
              transition: 'opacity 0.3s ease',
              pointerEvents: 'none',
            }}
          />
        </>
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
