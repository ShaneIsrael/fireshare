import React from 'react'
import { Box, Typography } from '@mui/material'
import BulkFileManager from '../components/admin/BulkFileManager'
import SnackbarAlert from '../components/alert/SnackbarAlert'

const FileManager = ({ authenticated, isAdmin }) => {
  const [alert, setAlert] = React.useState({ open: false })
  if (!isAdmin) return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography color="error">Admin access required.</Typography>
    </Box>
  )
  return (
    <Box sx={{ p: 3 }}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <BulkFileManager setAlert={setAlert} />
    </Box>
  )
}

export default FileManager
