import React from 'react'
import { Box, InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useDebounce } from '../../common/utils'

const Search = ({ searchHandler, placeholder, sx, autoFocus }) => {
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 500)

  React.useEffect(() => searchHandler(debouncedSearch), [debouncedSearch, searchHandler])

  return (
    <Box {...sx}>
      <TextField
        size="small"
        fullWidth
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: '#FFFFFF60' }} />
            </InputAdornment>
          ),
          sx: {
            borderRadius: '8px',
            bgcolor: '#FFFFFF0D',
            color: 'white',
            '& fieldset': { borderColor: '#FFFFFF26' },
            '&:hover fieldset': { borderColor: '#FFFFFF55' },
            '&.Mui-focused fieldset': { borderColor: '#3399FF' },
            '& input::placeholder': { color: '#FFFFFF60', opacity: 1 },
          },
        }}
      />
    </Box>
  )
}

export default Search
