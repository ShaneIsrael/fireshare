import React from 'react'
import { Autocomplete, TextField, InputAdornment, Box, CircularProgress } from '@mui/material'
import { GameService } from '../../services'

/**
 * Reusable game search autocomplete component
 * Searches SteamGridDB, creates game if needed, and calls onGameLinked callback
 */
const GameSearch = ({ onGameLinked, onError, disabled = false, placeholder = 'Search for a game...', sx = {} }) => {
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [gameOptions, setGameOptions] = React.useState([])
  const [gameSearchLoading, setGameSearchLoading] = React.useState(false)
  const [gameLinkLoading, setGameLinkLoading] = React.useState(false)

  const searchGames = async (query) => {
    if (!query || query.length < 2) {
      setGameOptions([])
      return
    }
    setGameSearchLoading(true)
    try {
      const results = (await GameService.searchSteamGrid(query)).data || []
      setGameOptions(results)
    } catch (err) {
      setGameOptions([])
    }
    setGameSearchLoading(false)
  }

  const handleGameChange = async (_, newValue) => {
    if (!newValue) {
      setSelectedGame(null)
      return
    }

    setSelectedGame(newValue)
    setGameLinkLoading(true)

    try {
      // Check if game already exists
      const allGames = (await GameService.getGames()).data
      let game = allGames.find((g) => g.steamgriddb_id === newValue.id)

      if (!game) {
        // Create the game
        const assets = (await GameService.getGameAssets(newValue.id)).data
        const gameData = {
          steamgriddb_id: newValue.id,
          name: newValue.name,
          release_date: newValue.release_date
            ? new Date(newValue.release_date * 1000).toISOString().split('T')[0]
            : null,
          hero_url: assets.hero_url,
          logo_url: assets.logo_url,
          icon_url: assets.icon_url,
        }
        game = (await GameService.createGame(gameData)).data
      }

      // Call the callback with the game
      if (onGameLinked) {
        onGameLinked(game)
      }

      // Reset the autocomplete
      setSelectedGame(null)
      setGameOptions([])
    } catch (err) {
      console.error('Error creating/linking game:', err)
      if (onError) {
        onError(err)
      }
      setSelectedGame(null)
    } finally {
      setGameLinkLoading(false)
    }
  }

  return (
    <Autocomplete
      value={selectedGame}
      onChange={handleGameChange}
      onInputChange={(_, val) => searchGames(val)}
      options={gameOptions}
      getOptionLabel={(option) => option.name || ''}
      loading={gameSearchLoading}
      disabled={disabled || gameLinkLoading}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={placeholder}
          size="small"
          sx={{
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            ...sx,
          }}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {gameLinkLoading && (
                  <InputAdornment position="end">
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                  </InputAdornment>
                )}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id}>
          {option.name}
          {option.release_date && ` (${new Date(option.release_date * 1000).getFullYear()})`}
        </Box>
      )}
    />
  )
}

export default GameSearch
