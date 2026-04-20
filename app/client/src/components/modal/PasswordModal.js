import React from 'react'
import { Modal, Box, Typography, Button, Stack, TextField, CircularProgress } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import { VideoService } from '../../services'

const PasswordModal = ({ open, onClose, videoId, onUnlocked }) => {
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    if (!open) {
      setPassword('')
      setError(null)
      setLoading(false)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!password) return
    setLoading(true)
    setError(null)
    try {
      await VideoService.unlockVideo(videoId, password)
      onUnlocked(videoId)
    } catch (err) {
      setError(err.response?.status === 403 ? 'Incorrect password.' : 'An error occurred. Please try again.')
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 380,
          maxWidth: 'calc(100vw - 32px)',
          bgcolor: '#041223',
          border: '1px solid #FFFFFF1A',
          borderRadius: '12px',
          boxShadow: '0 16px 48px #00000099',
          p: 4,
        }}
      >
        <Stack alignItems="center" spacing={2} mb={3}>
          <LockIcon sx={{ fontSize: 40, color: '#fff' }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'white', textAlign: 'center' }}>
            Password Protected
          </Typography>
          <Typography sx={{ fontSize: 14, color: '#FFFFFFB3', textAlign: 'center' }}>
            Enter the password to watch this video.
          </Typography>
        </Stack>
        <TextField
          fullWidth
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          error={!!error}
          helperText={error || ''}
          sx={{
            mb: 3,
            '& .MuiOutlinedInput-root': {
              color: 'white',
              '& fieldset': { borderColor: '#FFFFFF33' },
              '&:hover fieldset': { borderColor: '#FFFFFF66' },
              '&.Mui-focused fieldset': { borderColor: '#90CAF9' },
            },
            '& .MuiFormHelperText-root': { color: '#EF5350' },
          }}
        />
        <Stack direction="row" spacing={1.5}>
          <Button
            fullWidth
            variant="outlined"
            onClick={onClose}
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
            onClick={handleSubmit}
            disabled={loading || !password}
            sx={{ bgcolor: '#1565C0', '&:hover': { bgcolor: '#0D47A1' } }}
          >
            {loading ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Unlock'}
          </Button>
        </Stack>
      </Box>
    </Modal>
  )
}

export default PasswordModal
