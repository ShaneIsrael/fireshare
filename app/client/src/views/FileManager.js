import React from 'react'
import { Box, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import BulkFileManager from '../components/admin/BulkFileManager'
import SnackbarAlert from '../components/alert/SnackbarAlert'

const FileManager = ({ authenticated }) => {
  const [alert, setAlert] = React.useState({ open: false })
  if (!authenticated)
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          py: 8,
          px: 3,
          border: '1px solid #FFFFFF14',
          borderRadius: '16px',
          background: '#00000040',
          m: 4,
        }}
      >
        <LockOutlinedIcon sx={{ fontSize: 56, color: '#FFFFFF33' }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: 20, color: 'white', mb: 0.5 }}>
            You must be authenticated to access this page
          </Typography>
        </Box>
      </Box>
    )
  return (
    <Box>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>
      <BulkFileManager setAlert={setAlert} />
    </Box>
  )
}

export default FileManager
