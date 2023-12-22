import * as React from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from './Alert'

export default function SnackbarAlert({ severity, children, open, autoHideDuration, setOpen, onClose }) {
  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return
    }
    setOpen(false)
    if (onClose) {
      onClose()
    }
  }

  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration || 5000}
      onClose={handleClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
    >
      <Alert onClose={handleClose} severity={severity} sx={{ width: '100%' }}>
        {children}
      </Alert>
    </Snackbar>
  )
}
