import React from 'react'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import KeyIcon from '@mui/icons-material/Key'
import { UserService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import { inputSx, helperTextSx } from '../../common/modalStyles'

const PASSWORD_MIN = 8

const ChangePassword = () => {
  const [current, setCurrent] = React.useState('')
  const [next, setNext] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(null)
  const [alert, setAlert] = React.useState({ open: false })

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
      setCurrent('')
      setNext('')
      setConfirm('')
      setAlert({ open: true, type: 'success', message: 'Password changed.' })
    } catch (err) {
      setError(err.response?.data?.error || 'Could not change your password.')
    }
    setBusy(false)
  }

  return (
    <Box>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <KeyIcon sx={{ color: '#66B2FF' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Password</Typography>
      </Stack>

      <Box component="form" onSubmit={submit} sx={{ maxWidth: 420 }}>
        <Stack spacing={2}>
          <TextField
            type="password"
            label="Current password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            fullWidth
            sx={inputSx}
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
                ? 'Choose something different from your current password.'
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
          <Box>
            <Button type="submit" variant="contained" disabled={!canSubmit}>
              {busy ? 'Changing…' : 'Change password'}
            </Button>
          </Box>
        </Stack>
      </Box>
    </Box>
  )
}

export default ChangePassword
