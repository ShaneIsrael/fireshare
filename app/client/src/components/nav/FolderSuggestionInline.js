import React from 'react'
import { Box, Typography, IconButton, CircularProgress, Tooltip } from '@mui/material'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { GameService } from '../../services'

const FolderSuggestionInline = ({ open, suggestion, folderName, onApplied, onDismiss }) => {
  const [loading, setLoading] = React.useState(false)
  const folderHighlightSx = { color: '#3399FF', fontWeight: 600 }
  const countHighlightSx = { color: '#3399FF', fontWeight: 700 }

  if (!suggestion || !folderName) return null

  const handleApply = async () => {
    setLoading(true)
    try {
      const gamesRes = await GameService.getGames()
      let game = gamesRes.data.find(g => g.steamgriddb_id === suggestion.steamgriddb_id)

      if (!game) {
        const createRes = await GameService.createGame({
          name: suggestion.game_name,
          steamgriddb_id: suggestion.steamgriddb_id,
          release_date: suggestion.release_date,
        })
        game = createRes.data
      }

      const linkPromises = suggestion.video_ids.map(videoId =>
        GameService.linkVideoToGame(videoId, game.id)
      )
      await Promise.all(linkPromises)

      // Create folder rule for auto-tagging future videos
      await GameService.createFolderRule(folderName, game.id)

      await GameService.dismissFolderSuggestion(folderName)
      onApplied(folderName, game.name, suggestion.video_ids.length)
    } catch (err) {
      console.error('Error applying folder suggestion:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = async () => {
    setLoading(true)
    try {
      await GameService.dismissFolderSuggestion(folderName)
      onDismiss()
    } catch (err) {
      console.error('Error dismissing folder suggestion:', err)
    } finally {
      setLoading(false)
    }
  }

  if (open) {
    return (
      <Box
        sx={{
          m: 1,
          p: 1.5,
          border: '1px solid #3399FFAE',
          borderRadius: '8px',
          backgroundColor: (theme) => theme.palette.background.paper,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: 13,
              color: '#EBEBEB',
            }}
          >
            Game Detected
          </Typography>
        </Box>
        <Typography
          sx={{
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.7)',
            mb: 1,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
          }}
        >
          Found folder "
          <Box component="span" sx={folderHighlightSx}>
            {folderName}
          </Box>
          ". Link{' '}
          <Box component="span" sx={countHighlightSx}>
            {suggestion.video_count}
          </Box>{' '}
          clips to{' '}
          <Box component="span" sx={{ color: '#EBEBEB', fontWeight: 600 }}>
            {suggestion.game_name}
          </Box>
          ?
        </Typography>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
            <CircularProgress size={20} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton
              size="small"
              onClick={handleApply}
              sx={{
                flex: 1,
                borderRadius: '6px',
                bgcolor: 'rgba(76, 175, 80, 0.2)',
                color: '#4caf50',
                '&:hover': { bgcolor: 'rgba(76, 175, 80, 0.3)' },
              }}
            >
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{
                flex: 1,
                borderRadius: '6px',
                bgcolor: 'rgba(244, 67, 54, 0.2)',
                color: '#f44336',
                '&:hover': { bgcolor: 'rgba(244, 67, 54, 0.3)' },
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>
    )
  }

  // Collapsed view
  return (
    <Tooltip
      title={`Link ${suggestion.video_count} clips to ${suggestion.game_name}?`}
      arrow
      placement="right"
    >
      <Box
        sx={{
          m: 1,
          width: 42,
          height: 40,
          border: '1px solid #3399FFAE',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: (theme) => theme.palette.background.paper,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'rgba(194, 224, 255, 0.08)' },
        }}
      >
        <InfoOutlinedIcon sx={{ color: '#3399FF', fontSize: 20 }} />
      </Box>
    </Tooltip>
  )
}

export default FolderSuggestionInline
