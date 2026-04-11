import React from 'react'
import { Box, Tab, Tabs, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import VideoFileIcon from '@mui/icons-material/VideoFile'
import ImageIcon from '@mui/icons-material/Image'
import VideoFileManager from '../components/admin/VideoFileManager'
import ImageFileManager from '../components/admin/ImageFileManager'
import SnackbarAlert from '../components/alert/SnackbarAlert'

const FileManager = ({ authenticated }) => {
  const [alert, setAlert] = React.useState({ open: false })
  const [tab, setTab] = React.useState(0)
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
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 1.5,
          minHeight: 36,
          '& .MuiTab-root': {
            minHeight: 36,
            textTransform: 'none',
            color: '#FFFFFF88',
            fontSize: 13,
            fontWeight: 600,
            '&.Mui-selected': { color: '#FFFFFFEE' },
          },
          '& .MuiTabs-indicator': { bgcolor: '#3399FF' },
        }}
      >
        <Tab icon={<VideoFileIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Videos" />
        <Tab icon={<ImageIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Images" />
      </Tabs>
      {tab === 0 && <VideoFileManager setAlert={setAlert} />}
      {tab === 1 && <ImageFileManager setAlert={setAlert} />}
    </Box>
  )
}

export default FileManager
