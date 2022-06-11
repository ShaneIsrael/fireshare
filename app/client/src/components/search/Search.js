import React from 'react'
import { Box, InputAdornment, TextField } from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import { useDebounce } from '../../common/utils'

const Search = ({ searchHandler, placeholder, sx }) => {
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 500)

  React.useEffect(() => searchHandler(debouncedSearch), [debouncedSearch, searchHandler])

  return (
    <Box {...sx}>
      <TextField
        size="large"
        variant="standard"
        fullWidth
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
      />
    </Box>
  )
}

export default Search
