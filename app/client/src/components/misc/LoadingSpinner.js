import * as React from 'react'
import CircularProgress from '@mui/material/CircularProgress'

export default function LoadingSpinner({ size }) {
  return <CircularProgress disableShrink size={size ? size : 75} />
}
