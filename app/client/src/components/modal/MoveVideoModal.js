import React from 'react'
import { Modal, Box, Typography, Button, Stack } from '@mui/material'
import FolderIcon from '@mui/icons-material/Folder'
import Select from 'react-select'
import { VideoService } from '../../services'
import { labelSx, dialogPaperSx } from '../../common/modalStyles'
import selectFolderTheme from '../../common/reactSelectFolderTheme'

const MoveVideoModal = ({ open, onClose, video, alertHandler }) => {
  const [folders, setFolders] = React.useState([])
  const [targetFolder, setTargetFolder] = React.useState(null)
  const [loading, setLoading] = React.useState(false)

  const currentFolder = video?.path ? video.path.split('/')[0] : ''

  React.useEffect(() => {
    if (!open) return
    setTargetFolder(null)
    setLoading(false)
    VideoService.getUploadFolders()
      .then((res) => {
        const all = res.data?.folders || []
        setFolders(all.filter((f) => f !== currentFolder).map((f) => ({ value: f, label: `/videos/${f}/` })))
      })
      .catch(() => setFolders([]))
  }, [open, currentFolder])

  const handleMove = async () => {
    if (!targetFolder) return
    setLoading(true)
    try {
      await VideoService.move(video.video_id, targetFolder.value)
      alertHandler?.({ open: true, type: 'success', message: `Clip moved to "${targetFolder.value}".` })
      onClose('move', targetFolder.value)
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: err.response?.data || 'Failed to move clip.' })
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={() => onClose(null)}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 420,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: 'calc(100dvh - 32px)',
          overflowY: 'auto',
          p: 4,
          ...dialogPaperSx,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 2.5 }}>
          Move...
        </Typography>

        <Box sx={{ mb: 2 }}>
          <Typography sx={labelSx}>Current location</Typography>
          <Box
            sx={{
              bgcolor: '#FFFFFF0D',
              border: '1px solid #FFFFFF26',
              borderRadius: '8px',
              px: 1.5,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              fontSize: 14,
              fontFamily: 'Inter, sans-serif',
              color: '#FFFFFFCC',
            }}
          >
            {`/videos/${currentFolder}/`}
          </Box>
        </Box>

        <Box sx={{ mb: 3.5 }}>
          <Typography sx={labelSx}>Move to folder</Typography>
          <Select
            options={folders}
            value={targetFolder}
            onChange={setTargetFolder}
            placeholder="Select a folder…"
            styles={selectFolderTheme}
            isDisabled={loading}
            noOptionsMessage={() => 'No other folders available'}
          />
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => onClose(null)}
            disabled={loading}
            sx={{
              color: 'white',
              borderColor: '#FFFFFF44',
              '&:hover': { borderColor: 'white', bgcolor: '#FFFFFF12' },
            }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            startIcon={<FolderIcon />}
            onClick={handleMove}
            disabled={loading || !targetFolder}
            sx={{
              bgcolor: '#3399FF',
              '&:hover': { bgcolor: '#1976D2' },
              '&.Mui-disabled': { bgcolor: '#3399FF44', color: '#FFFFFF44' },
            }}
          >
            {loading ? 'Moving…' : 'Move'}
          </Button>
        </Stack>
      </Box>
    </Modal>
  )
}

export default MoveVideoModal
