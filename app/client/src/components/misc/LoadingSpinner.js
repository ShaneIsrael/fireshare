import * as React from 'react'
import Box from '@mui/material/Box'
import CircularProgress, { circularProgressClasses } from '@mui/material/CircularProgress'

function LoadingProgress({ size, ...rest }) {
  return (
    <Box sx={{ position: 'relative' }}>
      <CircularProgress
        variant="determinate"
        sx={{
          color: (theme) => theme.palette.grey[theme.palette.mode === 'light' ? 200 : 800],
        }}
        size={size ? size : 75}
        thickness={4}
        {...rest}
        value={100}
      />
      <CircularProgress
        variant="indeterminate"
        disableShrink
        sx={{
          color: (theme) => (theme.palette.mode === 'light' ? '#1a90ff' : '#308fe8'),
          animationDuration: '550ms',
          position: 'absolute',
          left: 0,
          [`& .${circularProgressClasses.circle}`]: {
            strokeLinecap: 'round',
          },
        }}
        size={size ? size : 75}
        thickness={4}
        {...rest}
      />
    </Box>
  )
}

export default function LoadingSpinner({ size }) {
  return <LoadingProgress size={size} />
}
