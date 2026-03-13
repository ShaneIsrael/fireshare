import * as React from 'react'
import { Modal, Box, Typography, Button, Stack, TextField, IconButton, Divider, Popover } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import { DayPicker } from 'react-day-picker'
import { VideoService, GameService } from '../../services'
import GameSearch from '../game/GameSearch'
import './datepicker-dark.css'

// ─── Shared style constants ───────────────────────────────────────────────────

const labelSx = { fontSize: 12, color: '#FFFFFFB3', mb: 1, textTransform: 'uppercase', letterSpacing: '0.08em' }

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    bgcolor: '#FFFFFF0D',
    borderRadius: '8px',
    '& fieldset': { borderColor: '#FFFFFF26' },
    '&:hover fieldset': { borderColor: '#FFFFFF55' },
    '&.Mui-focused fieldset': { borderColor: '#3399FF' },
  },
}

const rowBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: '8px',
  px: 1.5,
  py: 1,
}

const modalSx = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: '#041223',
  border: '1px solid #FFFFFF1A',
  borderRadius: '12px',
  boxShadow: '0 16px 48px #00000099',
  p: 4,
}

const timeInputStyle = {
  background: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: 6,
  color: 'white',
  fontSize: 13,
  padding: '4px 8px',
  colorScheme: 'dark',
  flex: 1,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const LabeledField = ({ label, children }) => (
  <Box>
    <Typography sx={labelSx}>{label}</Typography>
    {children}
  </Box>
)

const DateField = ({ selectedDate, selectedTime, onDateChange, onTimeChange }) => {
  const [anchor, setAnchor] = React.useState(null)

  const display = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + (selectedTime ? ` at ${selectedTime}` : '')
    : null

  return (
    <>
      <Box
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ ...rowBoxSx, cursor: 'pointer', py: 1.1, '&:hover': { borderColor: '#FFFFFF55' } }}
      >
        <CalendarMonthIcon sx={{ color: '#FFFFFF66', fontSize: 20 }} />
        <Typography sx={{ color: display ? 'white' : '#FFFFFF4D', fontSize: 14, flex: 1 }}>
          {display || 'Pick a date…'}
        </Typography>
        {selectedDate && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); onDateChange(null); onTimeChange('') }}
            sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.25 }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{ paper: { sx: { bgcolor: 'transparent', boxShadow: 'none', mt: 0.5 } } }}
      >
        <div className="fireshare-rdp">
          <DayPicker
            animate
            mode="single"
            selected={selectedDate}
            onSelect={(d) => onDateChange(d || null)}
            defaultMonth={selectedDate || new Date()}
          />
          <Box sx={{ px: 1, pb: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={{ color: '#FFFFFFB3', fontSize: 13 }}>Time</Typography>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => onTimeChange(e.target.value)}
              style={timeInputStyle}
            />
            <Button
              size="small"
              variant="contained"
              onClick={() => setAnchor(null)}
              sx={{ bgcolor: '#3399FF', '&:hover': { bgcolor: '#1976D2' }, minWidth: 60 }}
            >
              Done
            </Button>
          </Box>
        </div>
      </Popover>
    </>
  )
}

const LinkedGameField = ({ game, onLink, onUnlink, alertHandler }) => {
  if (game) {
    return (
      <Box sx={rowBoxSx}>
        {game.icon_url && (
          <img src={game.icon_url} alt="" onError={(e) => { e.currentTarget.style.display = 'none' }} style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'contain' }} />
        )}
        <Typography sx={{ color: 'white', fontSize: 14, flex: 1 }}>{game.name}</Typography>
        <IconButton size="small" onClick={onUnlink} sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  return (
    <Box sx={{
      ...rowBoxSx,
      py: 0,
      overflow: 'hidden',
      '& .MuiInputBase-root': { color: 'white', px: 0 },
      '& input::placeholder': { color: '#FFFFFF66', opacity: 1 },
      '& .MuiSvgIcon-root': { color: '#FFFFFF66' },
    }}>
      <GameSearch
        onGameLinked={onLink}
        onError={() => alertHandler?.({ open: true, type: 'error', message: 'Failed to find game.' })}
        onWarning={(msg) => alertHandler?.({ open: true, type: 'warning', message: msg })}
        placeholder="Search for a game..."
        sx={{ flex: 1 }}
      />
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const UpdateDetailsModal = ({ open, close, videoId, currentTitle, currentDescription, currentRecordedAt, currentGame, alertHandler }) => {
  const [title, setTitle] = React.useState(currentTitle)
  const [description, setDescription] = React.useState(currentDescription)
  const [selectedDate, setSelectedDate] = React.useState(null)
  const [selectedTime, setSelectedTime] = React.useState('')
  const [linkedGame, setLinkedGame] = React.useState(currentGame || null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    setTitle(currentTitle)
    setDescription(currentDescription)
    setLinkedGame(currentGame || null)
    if (!currentRecordedAt) {
      setSelectedDate(null)
      setSelectedTime('')
      return
    }
    const d = new Date(currentRecordedAt)
    const pad = (n) => n.toString().padStart(2, '0')
    setSelectedDate(d)
    setSelectedTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
  }, [currentTitle, currentDescription, currentRecordedAt, currentGame])

  const getRecordedAtISO = () => {
    if (!selectedDate) return null
    const d = new Date(selectedDate)
    if (selectedTime) {
      const [h, m] = selectedTime.split(':')
      d.setHours(+h, +m, 0, 0)
    }
    return d.toISOString()
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      await VideoService.updateDetails(videoId, {
        title: title || currentTitle,
        description: description || currentDescription,
        recorded_at: getRecordedAtISO(),
      })
      alertHandler?.({ open: true, type: 'success', message: 'Video details updated!' })
      close({ title: title || currentTitle, description: description || currentDescription, game: linkedGame })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: err.response?.data || 'An unknown error occurred.' })
    }
    setLoading(false)
  }

  const handleGameLinked = async (game) => {
    try {
      await GameService.linkVideoToGame(videoId, game.id)
      setLinkedGame(game)
      alertHandler?.({ open: true, type: 'success', message: `Linked to ${game.name}` })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to link game.' })
    }
  }

  const handleGameUnlink = async () => {
    try {
      await GameService.unlinkVideoFromGame(videoId)
      setLinkedGame(null)
      alertHandler?.({ open: true, type: 'info', message: 'Game unlinked.' })
    } catch (err) {
      alertHandler?.({ open: true, type: 'error', message: 'Failed to unlink game.' })
    }
  }

  return (
    <Modal open={open} onClose={() => close(null)}>
      <Box sx={modalSx}>
        <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 3 }}>
          Edit Video
        </Typography>

        <Stack spacing={2.5}>
          <LabeledField label="Title">
            <TextField value={title ?? ''} onChange={(e) => setTitle(e.target.value)} fullWidth sx={inputSx} />
          </LabeledField>

          <LabeledField label="Description">
            <TextField value={description ?? ''} onChange={(e) => setDescription(e.target.value)} multiline rows={3} fullWidth sx={inputSx} />
          </LabeledField>

          <LabeledField label="Recorded Date">
            <DateField
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              onDateChange={setSelectedDate}
              onTimeChange={setSelectedTime}
            />
          </LabeledField>

          <Divider sx={{ borderColor: '#FFFFFF14' }} />

          <LabeledField label="Linked Game">
            <LinkedGameField
              game={linkedGame}
              onLink={handleGameLinked}
              onUnlink={handleGameUnlink}
              alertHandler={alertHandler}
            />
          </LabeledField>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ mt: 4 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => close(null)}
            disabled={loading}
            sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: '#FFFFFF12' } }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleSave}
            disabled={loading}
            sx={{ bgcolor: '#3399FF', '&:hover': { bgcolor: '#1976D2' } }}
          >
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </Box>
    </Modal>
  )
}

export default UpdateDetailsModal
