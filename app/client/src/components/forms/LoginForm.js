import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, TextField, Button, Divider } from '@mui/material'
import { AuthService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import logo from '../../assets/logo.png'
import { getSetting } from '../../common/utils'

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    bgcolor: '#FFFFFF0A',
    borderRadius: '10px',
    '& fieldset': { borderColor: 'rgba(194, 224, 255, 0.2)' },
    '&:hover fieldset': { borderColor: 'rgba(194, 224, 255, 0.4)' },
    '&.Mui-focused fieldset': { borderColor: '#3399FF' },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(194, 224, 255, 0.5)',
    '&.Mui-focused': { color: '#3399FF' },
  },
}

const LoginForm = function () {
  const demoMode = getSetting('demo_mode')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [alert, setAlert] = React.useState({ open: false })
  const navigate = useNavigate()

  async function login() {
    if (!username || !password) {
      setAlert({ type: 'error', message: 'Username and password are required.', open: true })
      return
    }
    setLoading(true)
    try {
      await AuthService.login(username, password)
      navigate('/')
    } catch (err) {
      const status = err.response?.status
      setAlert({
        type: status === 401 ? 'warning' : 'error',
        message:
          status === 401 ? err.response.data : 'An unknown error occurred while trying to log in.',
        open: true,
      })
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && username && password) {
      e.preventDefault()
      login()
    }
  }

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 400,
        bgcolor: '#041223',
        border: '1px solid rgba(194, 224, 255, 0.12)',
        borderRadius: '16px',
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(194, 224, 255, 0.04)',
        p: { xs: 3, sm: 4 },
      }}
    >
      <SnackbarAlert
        severity={alert.type}
        open={alert.open}
        setOpen={(open) => setAlert({ ...alert, open })}
      >
        {alert.message}
      </SnackbarAlert>

      {/* Header */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
        <Box component="img" src={logo} alt="Fireshare logo" sx={{ height: 56, mb: 2 }} />
        <Typography
          sx={{ fontWeight: 700, fontSize: 26, color: 'white', letterSpacing: '-0.01em', mb: 0.5 }}
        >
          Fireshare
        </Typography>
        <Typography sx={{ fontSize: 13, color: 'rgba(194, 224, 255, 0.5)', fontWeight: 400 }}>
          Sign in to your account
        </Typography>
      </Box>

      <Divider sx={{ borderColor: 'rgba(194, 224, 255, 0.08)', mb: 3 }} />

      {/* Demo mode callout */}
      {demoMode && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            bgcolor: 'rgba(255, 167, 38, 0.08)',
            border: '1px solid rgba(255, 167, 38, 0.25)',
            borderRadius: '10px',
            px: 2,
            py: 1.25,
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              bgcolor: '#FFA726',
              flexShrink: 0,
            }}
          />
          <Typography sx={{ fontSize: 13, color: '#FFD180', lineHeight: 1.5 }}>
            <Box component="span" sx={{ fontWeight: 700 }}>Demo Mode</Box>
            {' — sign in with '}
            <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFE0B2' }}>demo</Box>
            {' / '}
            <Box component="span" sx={{ fontFamily: 'monospace', fontWeight: 700, color: '#FFE0B2' }}>demo</Box>
          </Typography>
        </Box>
      )}

      {/* Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          id="username"
          label="Username"
          variant="outlined"
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(e) => { setAlert({}); setUsername(e.target.value) }}
          onKeyDown={handleKeyDown}
          sx={inputSx}
        />
        <TextField
          fullWidth
          id="password"
          label="Password"
          type="password"
          variant="outlined"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={inputSx}
        />
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!username || !password || loading}
          onClick={login}
          sx={{
            mt: 1,
            py: 1.25,
            borderRadius: '10px',
            fontSize: 15,
            fontWeight: 600,
            textTransform: 'none',
            bgcolor: '#2684FF',
            '&:hover': { bgcolor: '#1a6fd4' },
            '&.Mui-disabled': { bgcolor: 'rgba(38, 132, 255, 0.2)', color: 'rgba(255,255,255,0.3)' },
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </Box>
    </Box>
  )
}

export default LoginForm
