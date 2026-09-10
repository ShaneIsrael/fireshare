import React from 'react'
import { useSearchParams, useNavigate, Link as RouterLink } from 'react-router-dom'
import { Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import { UserService } from '../services'
import { DisableDragDrop } from '../components/utils/GlobalDragDropOverlay'
import { inputSx, helperTextSx } from '../common/modalStyles'

const PASSWORD_MIN = 8

const SetupPassword = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') || ''

  const [checking, setChecking] = React.useState(true)
  const [account, setAccount] = React.useState(null)
  const [tokenError, setTokenError] = React.useState(null)
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [done, setDone] = React.useState(false)

  React.useEffect(() => {
    if (!token) {
      setTokenError('This link is missing its setup code.')
      setChecking(false)
      return
    }
    UserService.checkSetupToken(token)
      .then((res) => setAccount(res.data))
      .catch((err) =>
        setTokenError(err.response?.data?.error || 'This setup link is invalid or has expired.'),
      )
      .finally(() => setChecking(false))
  }, [token])

  const tooShort = password.length > 0 && password.length < PASSWORD_MIN
  const mismatch = confirm.length > 0 && password !== confirm
  const canSubmit = password.length >= PASSWORD_MIN && password === confirm && !submitting

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      await UserService.redeemSetupToken(token, password)
      setDone(true)
      setTimeout(() => navigate('/login'), 2200)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not set your password. Try again.')
    }
    setSubmitting(false)
  }

  return (
    <DisableDragDrop>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          px: 2,
          py: 6,
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(38, 132, 255, 0.12) 0%, transparent 70%),
            #001E3C
          `,
        }}
      >
        <Paper
          variant="outlined"
          sx={{ width: '100%', maxWidth: 440, p: 3.5, borderColor: '#1E4976', bgcolor: '#0A1929' }}
        >
          {checking && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!checking && tokenError && (
            <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
              <ErrorOutlineIcon sx={{ fontSize: 46, color: '#FF6B6B' }} />
              <Typography sx={{ fontSize: 19, fontWeight: 700 }}>Link not usable</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#B2BAC2' }}>{tokenError}</Typography>
              <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Ask an administrator to send you a new setup link.
              </Typography>
              <Button component={RouterLink} to="/login" variant="outlined" sx={{ mt: 1 }}>
                Go to sign in
              </Button>
            </Stack>
          )}

          {!checking && !tokenError && done && (
            <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center', py: 2 }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 46, color: '#1DB45A' }} />
              <Typography sx={{ fontSize: 19, fontWeight: 700 }}>Password set</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#B2BAC2' }}>
                Taking you to the sign-in page…
              </Typography>
            </Stack>
          )}

          {!checking && !tokenError && !done && (
            <Box component="form" onSubmit={submit}>
              <Stack spacing={2.5}>
                <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
                  <LockOutlinedIcon sx={{ fontSize: 34, color: '#66B2FF' }} />
                  <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Choose a password</Typography>
                  <Typography sx={{ fontSize: 13.5, color: '#B2BAC2' }}>
                    Setting up the account{' '}
                    <Box component="span" sx={{ fontFamily: 'monospace', color: '#66B2FF' }}>
                      @{account?.username}
                    </Box>
                  </Typography>
                </Stack>

                <TextField
                  type="password"
                  label="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete="new-password"
                  fullWidth
                  sx={inputSx}
                  error={tooShort}
                  helperText={
                    tooShort ? `Use at least ${PASSWORD_MIN} characters.` : `At least ${PASSWORD_MIN} characters.`
                  }
                  FormHelperTextProps={{ sx: helperTextSx }}
                />

                <TextField
                  type="password"
                  label="Confirm password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  fullWidth
                  sx={inputSx}
                  error={mismatch}
                  helperText={mismatch ? 'Passwords do not match.' : ' '}
                  FormHelperTextProps={{ sx: helperTextSx }}
                />

                {error && (
                  <Typography sx={{ fontSize: 13, color: '#FF6B6B' }}>{error}</Typography>
                )}

                <Button type="submit" variant="contained" size="large" disabled={!canSubmit} fullWidth>
                  {submitting ? 'Setting password…' : 'Set password'}
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      </Box>
    </DisableDragDrop>
  )
}

export default SetupPassword
