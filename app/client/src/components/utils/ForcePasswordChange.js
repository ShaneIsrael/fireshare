import React from 'react'
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import LockResetIcon from '@mui/icons-material/LockReset'
import { AuthService, UserService } from '../../services'
import { DisableDragDrop } from './GlobalDragDropOverlay'
import { inputSx, helperTextSx } from '../../common/modalStyles'

const PASSWORD_MIN = 8

/**
 * Shown in place of the app when an account was created with a password someone
 * else chose. This is a client-side gate: the account already holds valid
 * credentials, so it buys nothing to bypass, and enforcing it server-side would
 * mean rejecting every other endpoint for a signed-in user.
 */
const ForcePasswordChange = ({ currentUser, onChanged }) => {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)

  const tooShort = next.length > 0 && next.length < PASSWORD_MIN
  const mismatch = confirm.length > 0 && next !== confirm
  const sameAsOld = next.length > 0 && next === current
  const canSubmit =
    current.length > 0 && next.length >= PASSWORD_MIN && next === confirm && !sameAsOld && !busy

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    setError(null)
    try {
      await UserService.changePassword(current, next)
      onChanged?.()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change your password.')
      setBusy(false)
    }
  }

  const signOut = async () => {
    try {
      await AuthService.logout()
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <DisableDragDrop>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
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
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2.5}>
              <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
                <LockResetIcon sx={{ fontSize: 34, color: '#66B2FF' }} />
                <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Choose your own password</Typography>
                <Typography sx={{ fontSize: 13.5, color: '#B2BAC2' }}>
                  The password on{' '}
                  <Box component="span" sx={{ fontFamily: 'monospace', color: '#66B2FF' }}>
                    @{currentUser?.username}
                  </Box>{' '}
                  was set by an administrator. Pick one only you know to continue.
                </Typography>
              </Stack>

              <TextField
                type="password"
                label="Current password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoFocus
                autoComplete="current-password"
                fullWidth
                sx={inputSx}
                helperText="The one you were given."
                FormHelperTextProps={{ sx: helperTextSx }}
              />
              <TextField
                type="password"
                label="New password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
                fullWidth
                sx={inputSx}
                error={tooShort || sameAsOld}
                helperText={
                  sameAsOld
                    ? 'Choose something different from the one you were given.'
                    : `At least ${PASSWORD_MIN} characters.`
                }
                FormHelperTextProps={{ sx: helperTextSx }}
              />
              <TextField
                type="password"
                label="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                fullWidth
                sx={inputSx}
                error={mismatch}
                helperText={mismatch ? 'Passwords do not match.' : ' '}
                FormHelperTextProps={{ sx: helperTextSx }}
              />

              {error && <Typography sx={{ fontSize: 13, color: '#FF6B6B' }}>{error}</Typography>}

              <Button type="submit" variant="contained" size="large" disabled={!canSubmit} fullWidth>
                {busy ? 'Saving…' : 'Set password and continue'}
              </Button>
              <Button onClick={signOut} sx={{ color: '#B2BAC2' }} fullWidth>
                Sign out instead
              </Button>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </DisableDragDrop>
  )
}

export default ForcePasswordChange
