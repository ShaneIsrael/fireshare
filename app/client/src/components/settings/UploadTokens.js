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
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import TerminalIcon from '@mui/icons-material/Terminal'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import AddIcon from '@mui/icons-material/Add'
import { UserService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import { dialogPaperSx, dialogTitleSx, inputSx, helperTextSx, rowBoxSx } from '../../common/modalStyles'

const NAME_MAX = 64
const DOCS_URL = 'https://github.com/fireshare-app/fireshare/blob/main/docs/UploadTokens.md'

// Matches the external links in the Settings panes.
const docsLinkStyle = { color: '#2684FF', textDecoration: 'none' }

// The API serialises these columns as naive UTC, so the zone has to be supplied
// here — without it the browser would read the timestamp as local time.
const formatDate = (value) => {
  if (!value) return null
  const parsed = new Date(`${value}Z`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleString()
}

const errorMessage = (err, fallback) => err.response?.data?.error || fallback

const UploadTokens = () => {
  const [tokens, setTokens] = React.useState(null)
  const [maxTokens, setMaxTokens] = React.useState(20)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [busy, setBusy] = React.useState(false)
  const [alert, setAlert] = React.useState({ open: false })
  // The one moment the raw token exists on the client. Held only in component
  // state so it is gone the moment the dialog closes or the page is left.
  const [revealed, setRevealed] = React.useState(null)
  const [confirmAction, setConfirmAction] = React.useState(null)

  const load = React.useCallback(async () => {
    try {
      const { data } = await UserService.listUploadTokens()
      setTokens(data.tokens || [])
      if (data.max_tokens) setMaxTokens(data.max_tokens)
    } catch (err) {
      setTokens([])
      setAlert({ open: true, type: 'error', message: 'Failed to load upload tokens.' })
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  const copy = async (value) => {
    try {
      await navigator.clipboard.writeText(value)
      setAlert({ open: true, type: 'success', message: 'Token copied to the clipboard.' })
    } catch {
      setAlert({ open: true, type: 'error', message: 'Could not copy — select the token and copy it manually.' })
    }
  }

  const handleCreate = async () => {
    setBusy(true)
    try {
      const { data } = await UserService.createUploadToken(name.trim() || 'Upload token')
      setCreateOpen(false)
      setName('')
      setRevealed({ ...data.token, isNew: true })
      await load()
    } catch (err) {
      setAlert({ open: true, type: 'error', message: errorMessage(err, 'Could not create the token.') })
    }
    setBusy(false)
  }

  const handleRegenerate = async (token) => {
    setBusy(true)
    try {
      const { data } = await UserService.regenerateUploadToken(token.id)
      setConfirmAction(null)
      setRevealed({ ...data.token, isNew: false })
      await load()
    } catch (err) {
      setAlert({ open: true, type: 'error', message: errorMessage(err, 'Could not regenerate the token.') })
    }
    setBusy(false)
  }

  const handleDelete = async (token) => {
    setBusy(true)
    try {
      await UserService.deleteUploadToken(token.id)
      setConfirmAction(null)
      setAlert({ open: true, type: 'success', message: `"${token.name}" was deleted.` })
      await load()
    } catch (err) {
      setAlert({ open: true, type: 'error', message: errorMessage(err, 'Could not delete the token.') })
    }
    setBusy(false)
  }

  const atLimit = tokens !== null && tokens.length >= maxTokens

  return (
    <Box>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TerminalIcon sx={{ color: '#66B2FF' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 700 }}>Upload Tokens</Typography>
      </Stack>

      <Typography sx={{ ...helperTextSx, maxWidth: 560, mb: 2 }}>
        Let a script or another tool upload videos and images to Fireshare on your behalf, without your password.
        Uploads made with a token are credited to you and obey the permissions you hold right now — if your upload
        access is removed, every token stops working with it.{' '}
        <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" style={docsLinkStyle}>
          Read the documentation
        </a>{' '}
        for the full list of upload options.
      </Typography>

      {tokens === null ? (
        <CircularProgress size={24} />
      ) : (
        <Stack spacing={1.5} sx={{ maxWidth: 560 }}>
          {tokens.length === 0 && (
            <Typography sx={{ ...helperTextSx, fontStyle: 'italic' }}>
              You have no upload tokens yet.
            </Typography>
          )}

          {tokens.map((token) => (
            <Box key={token.id} sx={{ ...rowBoxSx, alignItems: 'flex-start', py: 1.25 }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14, color: 'white', wordBreak: 'break-word' }}>
                  {token.name}
                </Typography>
                <Typography sx={{ fontFamily: 'monospace', fontSize: 13, color: '#FFFFFFB3', mt: 0.25 }}>
                  {token.prefix}
                  {'…'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#FFFFFF80', mt: 0.5 }}>
                  {`Created ${formatDate(token.created_at) || 'unknown'}`}
                  {' · '}
                  {token.last_used_at ? `last used ${formatDate(token.last_used_at)}` : 'never used'}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                <Tooltip title="Regenerate">
                  <IconButton
                    size="small"
                    onClick={() => setConfirmAction({ type: 'regenerate', token })}
                    sx={{ color: '#FFFFFFB3' }}
                  >
                    <AutorenewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    onClick={() => setConfirmAction({ type: 'delete', token })}
                    sx={{ color: '#FF6B6B' }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          ))}

          <Box>
            <Tooltip title={atLimit ? `You can have at most ${maxTokens} tokens.` : ''}>
              <span>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  disabled={atLimit}
                  onClick={() => {
                    setName('')
                    setCreateOpen(true)
                  }}
                >
                  Create token
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Stack>
      )}

      {/* Create */}
      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        PaperProps={{ sx: dialogPaperSx }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={dialogTitleSx}>Create an upload token</DialogTitle>
        <DialogContent>
          <Typography sx={helperTextSx}>
            Name it after the tool or machine that will use it, so you know which one to revoke later.
          </Typography>
          <TextField
            fullWidth
            size="small"
            autoFocus
            label="Name"
            placeholder="Capture PC"
            value={name}
            inputProps={{ maxLength: NAME_MAX }}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !busy) {
                e.preventDefault()
                handleCreate()
              }
            }}
            sx={{ ...inputSx, mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" disabled={busy} onClick={handleCreate} sx={{ textTransform: 'none' }}>
            {busy ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reveal-once secret */}
      <Dialog
        open={Boolean(revealed)}
        onClose={() => setRevealed(null)}
        PaperProps={{ sx: dialogPaperSx }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={dialogTitleSx}>
          {revealed?.isNew ? 'Your new upload token' : 'Your regenerated upload token'}
        </DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Chip label="Shown once" color="warning" size="small" sx={{ fontWeight: 700 }} />
            <Typography sx={{ ...helperTextSx, fontSize: 13 }}>
              Copy it now — you won't be able to see it again.
            </Typography>
          </Stack>

          <Box
            sx={{
              ...rowBoxSx,
              alignItems: 'center',
              bgcolor: '#00000059',
            }}
          >
            <Typography
              sx={{
                fontFamily: 'monospace',
                fontSize: 13,
                color: 'white',
                wordBreak: 'break-all',
                flexGrow: 1,
              }}
            >
              {revealed?.secret}
            </Typography>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => copy(revealed?.secret)} sx={{ color: '#66B2FF' }}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Typography sx={{ ...helperTextSx, fontSize: 13, mt: 2.5, mb: 1 }}>
            Send it as a bearer token to upload a video or an image:
          </Typography>
          <Box
            component="pre"
            sx={{
              ...rowBoxSx,
              display: 'block',
              bgcolor: '#00000059',
              fontFamily: 'monospace',
              fontSize: 12,
              color: '#FFFFFFD9',
              overflowX: 'auto',
              m: 0,
              whiteSpace: 'pre',
            }}
          >
{`curl -X POST ${window.location.origin}/api/upload/token \\
  -H "Authorization: Bearer ${revealed?.secret || ''}" \\
  -F "file=@clip.mp4" \\
  -F "title=My clip" \\
  -F "folder=uploads"`}
          </Box>
          <Typography sx={{ ...helperTextSx, fontSize: 13, mt: 2 }}>
            Titles, folders, games and tags can all be set on the upload —{' '}
            <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" style={docsLinkStyle}>
              see the documentation
            </a>
            .
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setRevealed(null)} sx={{ textTransform: 'none' }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Regenerate / delete confirmation */}
      <Dialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        PaperProps={{ sx: dialogPaperSx }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={dialogTitleSx}>
          {confirmAction?.type === 'delete' ? 'Delete this token?' : 'Regenerate this token?'}
        </DialogTitle>
        <DialogContent>
          <Typography sx={helperTextSx}>
            {confirmAction?.type === 'delete'
              ? `Anything using "${confirmAction?.token?.name}" will stop being able to upload immediately. This cannot be undone.`
              : `"${confirmAction?.token?.name}" gets a new secret and the old one stops working immediately. You will need to update whatever uses it.`}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color={confirmAction?.type === 'delete' ? 'error' : 'primary'}
            disabled={busy}
            onClick={() =>
              confirmAction?.type === 'delete'
                ? handleDelete(confirmAction.token)
                : handleRegenerate(confirmAction.token)
            }
            sx={{ textTransform: 'none' }}
          >
            {busy ? <CircularProgress size={20} /> : confirmAction?.type === 'delete' ? 'Delete' : 'Regenerate'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UploadTokens
