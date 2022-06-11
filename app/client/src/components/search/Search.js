import { Grid, TextField } from '@mui/material'
import { Box } from '@mui/system'
import React from 'react'
import { useDebounce } from '../../common/utils'

const Search = ({ searchHandler, placeholder, sx }) => {
  const [search, setSearch] = React.useState('')
  const debouncedSearch = useDebounce(search, 500)

  React.useEffect(() => searchHandler(debouncedSearch), [debouncedSearch])

  return (
    <Box {...sx}>
      <TextField
        size="large"
        variant="standard"
        fullWidth
        placeholder={placeholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
    </Box>
  )
}

export default Search
