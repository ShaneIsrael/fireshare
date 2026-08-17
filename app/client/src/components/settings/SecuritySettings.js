import React from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SecurityIcon from '@mui/icons-material/Security'
import { AuthService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import { dialogPaperSx, dialogTitleSx, inputSx, helperTextSx } from '../../common/modalStyles'

const SecuritySettings = () => {
  const [status, setStatus] = React.useState(null)
  const [setupData, setSetupData] = React.useState(null)
  const [enableOpen, setEnableOpen] = React.useState(false)
  const [disableOpen, setDisableOpen] = React.useState(false)
  const [code, setCode] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [alert, setAlert] = React.useState({ open: false })

  const fetchStatus = React.useCallback(async () => {
    try {
      setStatus((await AuthService.getMfaStatus()).data)
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to load two-factor authentication status.', open: true })
    }
  }, [])

  React.useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  const errorMessage = (err, fallback) => err.response?.data?.error || fallback

  const handleEnableClick = async () => {
    setLoading(true)
    try {
      setSetupData((await AuthService.setupMfa()).data)
      setCode('')
      setEnableOpen(true)
    } catch (err) {
      setAlert({ type: 'error', message: errorMessage(err, 'Failed to start two-factor setup.'), open: true })
    }
    setLoading(false)
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await AuthService.confirmMfa(code)
      setEnableOpen(false)
      setSetupData(null)
      setAlert({ type: 'success', message: 'Two-factor authentication is now enabled.', open: true })
      await fetchStatus()
    } catch (err) {
      setAlert({ type: 'error', message: errorMessage(err, 'Failed to enable two-factor authentication.'), open: true })
    }
    setLoading(false)
  }

  const handleDisable = async () => {
    setLoading(true)
    try {
      await AuthService.disableMfa(code)
      setDisableOpen(false)
      setAlert({ type: 'success', message: 'Two-factor authentication has been disabled.', open: true })
      await fetchStatus()
    } catch (err) {
      setAlert({ type: 'error', message: errorMessage(err, 'Failed to disable two-factor authentication.'), open: true })
    }
    setLoading(false)
  }

  const codeField = (onSubmit) => (
    <TextField
      fullWidth
      size="small"
      label="6-digit code"
      autoFocus
      autoComplete="one-time-code"
      inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: '0.3em', textAlign: 'center' } }}
      value={code}
      onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && code) {
          e.preventDefault()
          onSubmit()
        }
      }}
      sx={{ ...inputSx, mt: 2 }}
    />
  )

  return (
    <Stack spacing={2} sx={{ maxWidth: 500, pt: 2 }}>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon sx={{ color: '#3399FF' }} />
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Two-Factor Authentication
        </Typography>
        {status?.enabled && <Chip label="Enabled" color="success" size="small" sx={{ fontWeight: 700 }} />}
      </Box>

      <Typography sx={helperTextSx}>
        Protect your account with a one-time code from an authenticator app (such as Google Authenticator, Authy, or
        Bitwarden) in addition to your password.
      </Typography>

      {!status ? (
        <CircularProgress size={24} />
      ) : !status.supported ? (
        <Typography sx={helperTextSx}>Two-factor authentication is not available for LDAP accounts.</Typography>
      ) : status.enabled ? (
        <Button variant="outlined" color="error" onClick={() => { setCode(''); setDisableOpen(true) }} sx={{ maxWidth: 400 }}>
          Disable Two-Factor Authentication
        </Button>
      ) : (
        <Button variant="contained" disabled={loading} onClick={handleEnableClick} sx={{ maxWidth: 400 }}>
          Enable Two-Factor Authentication
        </Button>
      )}

      {/* Enable dialog: QR + confirmation code */}
      <Dialog open={enableOpen} onClose={() => setEnableOpen(false)} PaperProps={{ sx: dialogPaperSx }} maxWidth="xs" fullWidth>
        <DialogTitle sx={dialogTitleSx}>Set up Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Typography sx={helperTextSx}>
            Scan this QR code with your authenticator app, then enter the 6-digit code it displays to confirm.
          </Typography>
          {setupData && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
              <Box
                component="img"
                src={setupData.qr}
                alt="TOTP QR code"
                sx={{ width: 200, height: 200, borderRadius: '8px', bgcolor: 'white', p: 1 }}
              />
              <Typography sx={{ ...helperTextSx, fontSize: 12, mt: 2 }}>
                Can't scan? Enter this key manually:
              </Typography>
              <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: 'white', wordBreak: 'break-all', mt: 0.5 }}>
                {setupData.secret}
              </Typography>
            </Box>
          )}
          {codeField(handleConfirm)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEnableOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={code.length !== 6 || loading} onClick={handleConfirm} sx={{ textTransform: 'none' }}>
            {loading ? <CircularProgress size={20} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Disable dialog: requires a current code */}
      <Dialog open={disableOpen} onClose={() => setDisableOpen(false)} PaperProps={{ sx: dialogPaperSx }} maxWidth="xs" fullWidth>
        <DialogTitle sx={dialogTitleSx}>Disable Two-Factor Authentication</DialogTitle>
        <DialogContent>
          <Typography sx={helperTextSx}>
            Enter a current code from your authenticator app to confirm disabling two-factor authentication.
          </Typography>
          {codeField(handleDisable)}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDisableOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={code.length !== 6 || loading}
            onClick={handleDisable}
            sx={{ textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={20} /> : 'Disable'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

export default SecuritySettings
