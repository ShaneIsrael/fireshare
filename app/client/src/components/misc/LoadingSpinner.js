import * as React from 'react'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

export default function LoadingSpinner({ size }) {
  return <CircularProgress size={size ? size : 75} />
}
