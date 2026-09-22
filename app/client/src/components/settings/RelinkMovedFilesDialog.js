import React from 'react'
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import CheckIcon from '@mui/icons-material/Check'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import { LibraryService } from '../../services'
import { checkboxSx, dialogTitleSx, helperTextSx } from '../../common/modalStyles'
import { useMobileFullScreenDialog } from '../../common/utils'

const POLL_MS = 1500

const monoSx = {
  fontFamily: 'Consolas, Menlo, Monaco, monospace',
  fontSize: 12,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 1.5,
  py: 1.25,
  borderTop: '1px solid #FFFFFF14',
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

/**
 * Drives the "find moved files" action end to end: starts the hash scan when
 * opened, shows its progress, then presents the plan with one checkbox per
 * matched file and applies only the ticked rows. onClose(changed) is called
 * with true when at least one record was relinked.
 */
export default function RelinkMovedFilesDialog({ open, onClose, alertHandler }) {
  const dialogProps = useMobileFullScreenDialog()
  const [status, setStatus] = React.useState(null)
  const [failedToStart, setFailedToStart] = React.useState(null)
  const [selected, setSelected] = React.useState(new Set())
  const [applying, setApplying] = React.useState(false)
  const pollRef = React.useRef(null)

  const stopPolling = React.useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // Every open is a fresh scan: the plan goes stale the moment anything on disk
  // changes, so there is nothing worth showing from a previous run.
  React.useEffect(() => {
    if (!open) {
      stopPolling()
      return
    }
    setStatus(null)
    setFailedToStart(null)
    setSelected(new Set())
    setApplying(false)

    let cancelled = false
    const poll = async () => {
      try {
        const res = await LibraryService.relinkStatus()
        if (cancelled) return
        setStatus(res.data)
        if (!res.data.is_running) {
          stopPolling()
          const matches = res.data.result?.matches || []
          setSelected(new Set(matches.map((m) => `${m.kind}:${m.id}`)))
        }
      } catch (err) {
        if (cancelled) return
        stopPolling()
        setFailedToStart(err.response?.data || 'Could not reach the server.')
      }
    }

    LibraryService.startRelinkScan()
      .catch((err) => {
        // 409 means a scan is already running; polling picks it up like any other.
        if (err.response?.status !== 409) throw err
      })
      .then(() => {
        if (cancelled) return
        poll()
        pollRef.current = setInterval(poll, POLL_MS)
      })
      .catch((err) => {
        if (cancelled) return
        setFailedToStart(
          typeof err.response?.data === 'string' ? err.response.data : err.response?.data?.message || 'Could not start the scan.',
        )
      })

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [open, stopPolling])

  const result = status && !status.is_running ? status.result : null
  const matches = result?.matches || []
  const unmatched = result?.unmatched || []
  const missingCount = status ? (status.missing?.videos || 0) + (status.missing?.images || 0) : 0
  const scanning = !failedToStart && (!status || status.is_running)
  const selectedItems = matches.filter((m) => selected.has(`${m.kind}:${m.id}`))

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const handleApply = async () => {
    if (selectedItems.length === 0) return
    setApplying(true)
    try {
      const res = await LibraryService.applyRelink(
        selectedItems.map((m) => ({ kind: m.kind, id: m.id, new_path: m.new_path })),
      )
      const relinked = res.data.relinked?.length || 0
      const errors = res.data.errors || []
      alertHandler?.({
        open: true,
        type: errors.length ? 'warning' : 'success',
        message: errors.length
          ? `Relinked ${plural(relinked, 'file')}, ${plural(errors.length, 'file')} could not be relinked: ${errors
              .map((e) => e.error)
              .join('; ')}`
          : `Relinked ${plural(relinked, 'file')}.`,
      })
      onClose(relinked > 0)
    } catch (err) {
      alertHandler?.({
        open: true,
        type: 'error',
        message: typeof err.response?.data === 'string' ? err.response.data : 'Relinking failed.',
      })
      setApplying(false)
    }
  }

  const renderKindIcon = (kind) =>
    kind === 'video' ? (
      <VideoLibraryIcon sx={{ fontSize: 18, color: '#66B2FF' }} />
    ) : (
      <PhotoLibraryIcon sx={{ fontSize: 18, color: '#66B2FF' }} />
    )

  let body
  if (failedToStart) {
    body = (
      <Typography sx={{ ...helperTextSx, color: '#FF99A2' }}>{String(failedToStart)}</Typography>
    )
  } else if (scanning) {
    const total = status?.total || 0
    const current = status?.current || 0
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, py: 1 }}>
        <Typography sx={helperTextSx}>
          {total > 0
            ? `Hashing files that are not indexed where they sit: ${current} of ${total}.`
            : 'Looking for files that are not indexed where they sit…'}
        </Typography>
        <LinearProgress
          variant={total > 0 ? 'determinate' : 'indeterminate'}
          value={total > 0 ? (100 * current) / total : undefined}
          sx={{ borderRadius: 2, height: 6, bgcolor: '#FFFFFF14' }}
        />
      </Box>
    )
  } else if (status?.error) {
    body = <Typography sx={{ ...helperTextSx, color: '#FF99A2' }}>The scan failed: {status.error}</Typography>
  } else if (missingCount === 0 && matches.length === 0) {
    body = (
      <Typography sx={helperTextSx}>
        Nothing is missing. Every video and image is where Fireshare last saw it.
      </Typography>
    )
  } else {
    body = (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Typography sx={helperTextSx}>
          Hashed {plural(result?.hashed || 0, 'file')} across {plural(result?.folders || 0, 'folder')} in{' '}
          {result?.seconds ?? 0}s.{' '}
          <Box component="span" sx={{ color: 'white', fontWeight: 600 }}>
            {matches.length} of {matches.length + unmatched.length}
          </Box>{' '}
          missing {matches.length + unmatched.length === 1 ? 'file was' : 'files were'} found at a new location.
        </Typography>
        <Box sx={{ border: '1px solid #FFFFFF14', borderRadius: '10px', overflow: 'hidden' }}>
          {matches.map((m) => {
            const key = `${m.kind}:${m.id}`
            return (
              <Box key={key} sx={{ ...rowSx, '&:first-of-type': { borderTop: 'none' } }}>
                <Checkbox
                  checked={selected.has(key)}
                  onChange={() => toggle(key)}
                  sx={checkboxSx}
                  inputProps={{ 'aria-label': `Relink ${m.title}` }}
                />
                {renderKindIcon(m.kind)}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', ...monoSx, fontFamily: 'inherit' }}>
                    {m.title}
                    {m.copies > 1 && (
                      <Box component="span" sx={{ ml: 1, fontSize: 12, fontWeight: 500, color: '#FFDC48' }}>
                        {m.copies} identical copies, first one used
                      </Box>
                    )}
                  </Typography>
                  <Typography sx={{ ...monoSx, color: '#FFFFFF80', textDecoration: m.same_place ? 'none' : 'line-through' }}>
                    {m.old_path}
                  </Typography>
                  <Typography sx={{ ...monoSx, color: '#6AE79C' }}>
                    {m.same_place ? 'Back at its original location' : m.new_path}
                  </Typography>
                </Box>
              </Box>
            )
          })}
          {unmatched.map((u) => (
            <Box key={`${u.kind}:${u.id}`} sx={{ ...rowSx, opacity: 0.6, '&:first-of-type': { borderTop: 'none' } }}>
              <WarningAmberIcon sx={{ fontSize: 20, color: '#DEA500', mx: 0.5 }} />
              {renderKindIcon(u.kind)}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: 'white', ...monoSx, fontFamily: 'inherit' }}>
                  {u.title}
                </Typography>
                <Typography sx={{ ...monoSx, color: '#FFFFFF80' }}>{u.old_path}</Typography>
                <Typography sx={{ ...monoSx, color: '#FFDC48' }}>No file with this content found</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    )
  }

  return (
    <Dialog open={open} onClose={() => onClose(false)} maxWidth="md" fullWidth {...dialogProps}>
      <DialogTitle sx={dialogTitleSx}>Relink moved files</DialogTitle>
      <DialogContent sx={{ pt: 0 }}>{body}</DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.5, alignItems: 'center' }}>
        <Typography sx={{ ...helperTextSx, fontSize: 12, flex: 1, minWidth: 0 }}>
          {matches.length > 0 &&
            'Nothing is moved on disk. Only each record’s path, folder and playback link change; posters, transcodes and views stay attached.'}
        </Typography>
        <Button onClick={() => onClose(false)} disabled={applying} sx={{ color: '#B2BAC2' }}>
          {matches.length > 0 ? 'Cancel' : 'Close'}
        </Button>
        {matches.length > 0 && (
          <Button
            variant="contained"
            onClick={handleApply}
            disabled={applying || selectedItems.length === 0}
            startIcon={applying ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
          >
            Relink {plural(selectedItems.length, 'file')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
