import React from 'react'
import { Modal, Box, Typography, Button, Stack } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { VideoService } from '../../services'

// Accepts either videoId (string) for single, or videoIds (array) for bulk
const DeleteVideoModal = ({ open, onClose, videoId, videoIds, alertHandler }) => {
  const [loading, setLoading] = React.useState(false)
  const isBulk = Array.isArray(videoIds)
  const count = isBulk ? videoIds.length : 1

  const handleDelete = async () => {
    setLoading(true)
    try {
      if (isBulk) {
        await Promise.all(videoIds.map((id) => VideoService.delete(id)))
        alertHandler?.({ open: true, type: 'success', message: `${count} video${count > 1 ? 's' : ''} deleted.` })
      } else {
        await VideoService.delete(videoId)
        alertHandler?.({ open: true, type: 'success', message: 'Video has been deleted.' })
      }
      onClose('delete')
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: err.response?.data || 'An unknown error occurred.' })
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
          bgcolor: '#041223',
          border: '1px solid #FFFFFF1A',
          borderRadius: '12px',
          boxShadow: '0 16px 48px #00000099',
          p: 4,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 1.5 }}>
          {isBulk ? `Permanently delete ${count} video${count > 1 ? 's' : ''}?` : 'Permanently delete this video?'}
        </Typography>
        <Typography sx={{ fontSize: 14, color: '#FFFFFFB3', lineHeight: 1.6, mb: 3.5 }}>
          Deleting this clip will also remove all related data, including thumbnails, transcoded versions, and any edits
          to its title or date. Are you sure?
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => onClose(null)}
            disabled={loading}
            sx={{
              color: 'white',
              borderColor: 'white',
              '&:hover': { borderColor: 'white', bgcolor: '#FFFFFF12' },
            }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            startIcon={<DeleteOutlineIcon />}
            onClick={handleDelete}
            disabled={loading}
            sx={{
              bgcolor: '#EF5350',
              '&:hover': { bgcolor: '#C62828' },
            }}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </Button>
        </Stack>
      </Box>
    </Modal>
  )
}

export default DeleteVideoModal
