import React, { useEffect, useState } from 'react'
import { Box, Button, Divider, IconButton, Modal, Paper, Popover, TextField, Tooltip, Typography } from '@mui/material'
import { motion } from 'framer-motion'
import { DayPicker } from 'react-day-picker'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloseIcon from '@mui/icons-material/Close'
import './datepicker-dark.css'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VisibilityIcon from '@mui/icons-material/Visibility'
import {
  copyToClipboard,
  getPublicWatchUrl,
  getServedBy,
  getUrl,
  getVideoSources,
  getSetting,
} from '../../common/utils'
import { ConfigService, VideoService, GameService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'
import VideoJSPlayer from '../misc/VideoJSPlayer'
import GameSearch from '../game/GameSearch'
import { FastAverageColor } from 'fast-average-color'

const URL = getUrl()
const PURL = getPublicWatchUrl()
const SERVED_BY = getServedBy()

// ─── Shared style constants (matching UpdateDetailsModal / CompactVideoCard) ──

const labelSx = {
  fontSize: 11,
  color: '#FFFFFFB3',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  mb: 0.75,
}

const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    bgcolor: '#FFFFFF0D',
    borderRadius: '8px',
    '& fieldset': { borderColor: '#FFFFFF26' },
    '&:hover fieldset': { borderColor: '#FFFFFF55' },
    '&.Mui-focused fieldset': { borderColor: '#3399FF' },
  },
  '& .MuiInputBase-input.Mui-disabled': {
    WebkitTextFillColor: 'rgba(255, 255, 255, 0.85)',
  },
}

const rowBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: '8px',
  px: 1.5,
  py: 1,
}

const actionBtnSx = {
  color: '#FFFFFFB3',
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF1A',
  borderRadius: '8px',
  p: 1,
  '&:hover': { bgcolor: '#FFFFFF1A', color: 'white' },
}

const SIDEBAR_WIDTH = 'clamp(280px, 24vw, 420px)'

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

const DateField = ({ selectedDate, selectedTime, onDateChange, onTimeChange }) => {
  const [anchor, setAnchor] = React.useState(null)
  const display = selectedDate
    ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      (selectedTime ? ` at ${selectedTime}` : '')
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
            onClick={(e) => {
              e.stopPropagation()
              onDateChange(null)
              onTimeChange('')
            }}
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

// ─── Component ────────────────────────────────────────────────────────────────

const VideoModal = ({ open, onClose, videoId, feedView, authenticated, updateCallback, onNext, onPrev }) => {
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [updateable, setUpdatable] = React.useState(false)
  const [privateView, setPrivateView] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState(null)
  const [selectedTime, setSelectedTime] = React.useState('')
  const [vid, setVideo] = React.useState(null)
  const [viewAdded, setViewAdded] = React.useState(false)
  const [alert, setAlert] = React.useState({ open: false, type: 'info', message: '' })
  const [autoplay, setAutoplay] = useState(false)
  const [selectedGame, setSelectedGame] = React.useState(null)
  const [editMode, setEditMode] = React.useState(false)
  const [gamePillColor, setGamePillColor] = React.useState(null)

  const playerRef = React.useRef()

  useEffect(() => {
    if (!open || editMode) return
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'ArrowRight') onNext?.()
      if (e.key === 'ArrowLeft') onPrev?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, editMode, onNext, onPrev])

  React.useEffect(() => {
    if (!selectedGame?.icon_url) {
      setGamePillColor(null)
      return
    }
    const fac = new FastAverageColor()
    fac
      .getColorAsync(selectedGame.icon_url, { crossOrigin: 'anonymous', algorithm: 'dominant' })
      .then((color) => setGamePillColor(color.value.slice(0, 3)))
      .catch(() => setGamePillColor(null))
  }, [selectedGame?.icon_url])

  const getRandomVideo = async () => {
    try {
      const res = !feedView
        ? (await VideoService.getRandomVideo()).data
        : (await VideoService.getRandomPublicVideo()).data

      setViewAdded(false)
      setVideo(res)
      setTitle(res.info?.title)
      setDescription(res.info?.description)
      setUpdatable(false)
      setPrivateView(res.info?.private)
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const result = await ConfigService.getConfig()
        setAutoplay(result.data?.autoplay || false)
      } catch (error) {
        console.error('Error fetching config:', error)
      }
    }
    fetchConfig()
  }, [])

  React.useEffect(() => {
    let cancelled = false
    async function fetch() {
      try {
        const details = (await VideoService.getDetails(videoId)).data
        if (cancelled) return
        setViewAdded(false)
        setVideo(details)
        setTitle(details.info?.title)
        setDescription(details.info?.description)
        setPrivateView(details.info?.private)
        setUpdatable(false)
        if (details.recorded_at) {
          const d = new Date(details.recorded_at)
          const pad = (n) => n.toString().padStart(2, '0')
          setSelectedDate(d)
          setSelectedTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)
        } else {
          setSelectedDate(null)
          setSelectedTime('')
        }
        try {
          const gameData = (await GameService.getVideoGame(videoId)).data
          if (cancelled) return
          setSelectedGame(gameData || null)
        } catch (err) {
          if (!cancelled) setSelectedGame(null)
        }
      } catch (err) {
        if (!cancelled) setAlert({ type: 'error', message: 'Unable to load video details', open: true })
      }
    }
    if (videoId) {
      setTitle('')
      setDescription('')
      setSelectedGame(null)
      setSelectedDate(null)
      setSelectedTime('')
      setEditMode(false)
      fetch()
    }
    return () => {
      cancelled = true
    }
  }, [videoId])

  const handleGameLinked = async (game, warning) => {
    try {
      await GameService.linkVideoToGame(vid.video_id, game.id)
      setSelectedGame(game)
      if (warning) {
        setAlert({ type: 'warning', message: `Linked to ${game.name}. ${warning}`, open: true })
      } else {
        setAlert({ type: 'success', message: `Linked to ${game.name}`, open: true })
      }
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to link game', open: true })
    }
  }

  const handleUnlinkGame = async () => {
    try {
      await GameService.unlinkVideoFromGame(vid.video_id)
      setSelectedGame(null)
      setAlert({ type: 'info', message: 'Game link removed', open: true })
    } catch (err) {
      setAlert({ type: 'error', message: 'Failed to unlink game', open: true })
    }
  }

  const handleMouseDown = (e) => {
    if (e.button === 1) window.open(`${PURL}${vid.video_id}`, '_blank')
  }

  const getRecordedAtISO = () => {
    if (!selectedDate) return null
    const d = new Date(selectedDate)
    if (selectedTime) {
      const [h, m] = selectedTime.split(':')
      d.setHours(+h, +m, 0, 0)
    }
    return d.toISOString()
  }

  const update = async () => {
    if (updateable && authenticated) {
      try {
        await VideoService.updateDetails(vid.video_id, { title, description, recorded_at: getRecordedAtISO() })
        setUpdatable(false)
        setEditMode(false)
        updateCallback({ id: vid.video_id, title, description })
        setAlert({ type: 'success', message: 'Details Updated', open: true })
      } catch (err) {
        setAlert({ type: 'error', message: 'An error occurred trying to update the title', open: true })
      }
    }
  }

  const handlePrivacyChange = async () => {
    if (authenticated) {
      try {
        await VideoService.updatePrivacy(vid.video_id, !privateView)
        updateCallback({ id: vid.video_id, private: !privateView })
        setAlert({
          type: privateView ? 'info' : 'warning',
          message: privateView ? 'Added to your public feed' : 'Removed from your public feed',
          open: true,
        })
        setPrivateView(!privateView)
      } catch (err) {
        console.log(err)
      }
    }
  }

  const handleTitleChange = (newValue) => {
    if (newValue) setUpdatable(newValue !== vid.info?.title || description !== vid.info?.description)
    setTitle(newValue)
  }

  const handleDescriptionChange = (newValue) => {
    if (newValue) setUpdatable(newValue !== vid.info?.description || title !== vid.info?.title)
    setDescription(newValue)
  }

  const copyTimestamp = () => {
    let currentTime = 0
    if (playerRef.current && typeof playerRef.current.currentTime === 'function') {
      const time = playerRef.current.currentTime()
      currentTime = time && !isNaN(time) ? time : 0
    }
    copyToClipboard(`${PURL}${vid.video_id}?t=${currentTime}`)
    setAlert({ type: 'info', message: 'Time stamped link copied to clipboard', open: true })
  }

  const handleTimeUpdate = (e) => {
    if (!viewAdded) {
      const currentTime = e.playedSeconds || 0
      if (!vid.info?.duration || vid.info?.duration < 10) {
        setViewAdded(true)
        VideoService.addView(vid?.video_id || videoId).catch((err) => console.error(err))
      } else if (currentTime >= 10) {
        setViewAdded(true)
        VideoService.addView(vid?.video_id || videoId).catch((err) => console.error(err))
      }
    }
  }

  const getPosterUrl = () => {
    if (SERVED_BY === 'nginx') return `${URL}/_content/derived/${vid.video_id}/poster.jpg`
    return `${URL}/api/video/poster?id=${vid.video_id}`
  }

  if (!vid) return null

  // Video aspect ratio — drives the modal height via CSS min().
  const ar = Number(((vid?.info?.width || 16) / (vid?.info?.height || 9)).toFixed(6))
  // Height: fit within viewport (minus 96px padding each side) and available width minus sidebar.
  const videoH_css = `min(calc((100vw - 192px - clamp(280px, 24vw, 420px)) / ${ar}), calc(100vh - 192px))`
  // Width: height × aspect ratio.
  const videoW_css = `calc((${videoH_css}) * ${ar})`

  return (
    <>
      <SnackbarAlert severity={alert.type} open={alert.open} setOpen={(open) => setAlert({ ...alert, open })}>
        {alert.message}
      </SnackbarAlert>

      <Modal
        open={open}
        onClose={onClose}
        disableAutoFocus={true}
        slotProps={{ backdrop: { sx: { backgroundColor: 'rgba(0, 0, 0, 0.7)' } } }}
      >
        {/* Centering wrapper — click-outside closes modal */}
        <Box
          tabIndex={-1}
          sx={{
            outline: 'none',
            display: 'flex',
            height: '100%',
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'center',
            // Full-screen on small viewports, padded on desktop
            p: { xs: 0, md: '96px' },
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', width: '100%', maxWidth: '100%', maxHeight: '100%' }}
          >
            <Paper
              sx={{
                borderRadius: { xs: 0, md: '8px' },
                overflow: 'hidden',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8)',
                bgcolor: '#020D1A',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                // Small: auto-height so it can be vertically centred. Desktop: sized to video AR.
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: videoH_css },
                maxHeight: '100%',
                maxWidth: '100%',
              }}
            >
              {/* ── Left: Video Player ───────────────────────────────────────── */}
              <Box
                sx={{
                  position: 'relative',
                  flexShrink: 0,
                  bgcolor: '#020D1A',
                  // Desktop: explicit dimensions from CSS; mobile: 100% wide, AR height.
                  width: { xs: '100%', md: videoW_css },
                  height: { xs: 'auto', md: '100%' },
                  aspectRatio: { xs: `${vid?.info?.width || 16} / ${vid?.info?.height || 9}`, md: 'initial' },
                  // Override VideoJS default 8px border-radius responsively
                  '& > div': {
                    borderRadius: { xs: '0 !important', md: '8px 0 0 8px !important' },
                  },
                }}
              >
                <VideoJSPlayer
                  key={vid.video_id}
                  sources={getVideoSources(vid.video_id, vid?.info, vid.extension)}
                  poster={getPosterUrl()}
                  autoplay={autoplay}
                  controls={true}
                  onTimeUpdate={handleTimeUpdate}
                  onReady={(player) => {
                    playerRef.current = player
                  }}
                  fill={true}
                  fluid={false}
                  playsinline={true}
                />
              </Box>

              {/* ── Right: Info Sidebar ──────────────────────────────────────── */}
              <Box
                sx={{
                  width: { xs: '100%', md: SIDEBAR_WIDTH },
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: '#041223',
                  borderLeft: { md: '1px solid #FFFFFF14' },
                  borderTop: { xs: '1px solid #FFFFFF14', md: 'none' },
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2.5,
                    pt: 2,
                    pb: 1.75,
                    flexShrink: 0,
                  }}
                >
                  <Typography
                    sx={{
                      fontWeight: 700,
                      fontSize: 12,
                      color: '#FFFFFF66',
                      textTransform: 'uppercase',
                      letterSpacing: '0.12em',
                    }}
                  >
                    Now Playing
                  </Typography>
                  <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{
                      color: '#FFFFFF80',
                      bgcolor: '#FFFFFF14',
                      borderRadius: '8px',
                      '&:hover': { bgcolor: '#FFFFFF2A', color: 'white' },
                      width: 30,
                      height: 30,
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 17 }} />
                  </IconButton>
                </Box>

                <Divider sx={{ borderColor: '#FFFFFF14', flexShrink: 0 }} />

                {/* Scrollable info content */}
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    px: 2.5,
                    pt: 2,
                    pb: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    '&::-webkit-scrollbar': { width: 4 },
                    '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#FFFFFF26', borderRadius: 2 },
                  }}
                >
                  {/* Title */}
                  <Box>
                    {editMode ? (
                      <TextField
                        fullWidth
                        size="small"
                        value={title || ''}
                        placeholder="Video Title"
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && update()}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                        sx={inputSx}
                      />
                    ) : (
                      <Typography
                        sx={{
                          fontWeight: 900,
                          fontSize: 21,
                          color: 'white',
                          lineHeight: 1.3,
                          letterSpacing: '-0.03em',
                          overflowX: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {title || 'Untitled'}
                      </Typography>
                    )}
                    {/* Views + Game inline row */}
                    {!editMode && (
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mt: 0.5, gap: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Typography sx={{ fontSize: 14, color: '#FFFFFF55', flexShrink: 0 }}>
                            {(vid.view_count ?? 0).toLocaleString()} {vid.view_count === 1 ? 'view' : 'views'}
                          </Typography>
                          {vid.recorded_at && (
                            <>
                              <Typography sx={{ fontSize: 14, color: '#FFFFFF55' }}>|</Typography>
                              <Typography sx={{ fontSize: 14, color: '#FFFFFF55' }}>
                                {new Date(vid.recorded_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </Typography>
                            </>
                          )}
                        </Box>
                        {selectedGame && (
                          <Box
                            component={selectedGame.steamgriddb_id ? 'a' : 'div'}
                            href={selectedGame.steamgriddb_id ? `#/games/${selectedGame.steamgriddb_id}` : undefined}
                            onClick={selectedGame.steamgriddb_id ? (e) => e.stopPropagation() : undefined}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.75,
                              minWidth: 0,
                              bgcolor: gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.15)` : '#FFFFFF14',
                              border: `1px solid ${gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.5)` : '#FFFFFF26'}`,
                              borderRadius: '8px',
                              px: 1,
                              py: 0.35,
                              textDecoration: 'none',
                              flexShrink: 0,
                              ...(selectedGame.steamgriddb_id && {
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: gamePillColor ? `rgba(${gamePillColor.join(',')}, 0.4)` : '#FFFFFF22',
                                },
                              }),
                            }}
                          >
                            {selectedGame.icon_url && (
                              <img
                                src={selectedGame.icon_url}
                                alt=""
                                onError={(e) => { e.currentTarget.style.display = 'none' }}
                                style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                              />
                            )}
                            <Typography
                              sx={{
                                fontSize: 14,
                                color: '#FFFFFF',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {selectedGame.name}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>

                  {/* Game search (edit mode only) */}
                  {editMode && (authenticated || getSetting('ui_config')?.allow_public_game_tag) && (
                    <Box>
                      {selectedGame ? (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            bgcolor: '#FFFFFF0D',
                            border: '1px solid #FFFFFF26',
                            borderRadius: '8px',
                            px: 1.5,
                            py: 1,
                          }}
                        >
                          {selectedGame.icon_url && (
                            <img
                              src={selectedGame.icon_url}
                              alt=""
                              onError={(e) => { e.currentTarget.style.display = 'none' }}
                              style={{ width: 20, height: 20, objectFit: 'contain', borderRadius: 3, flexShrink: 0 }}
                            />
                          )}
                          <Typography
                            sx={{
                              fontSize: 13,
                              color: '#FFFFFFB3',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              flex: 1,
                            }}
                          >
                            {selectedGame.name}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={handleUnlinkGame}
                            sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.25 }}
                          >
                            <CloseIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            ...rowBoxSx,
                            py: 0,
                            overflow: 'hidden',
                            '& .MuiInputBase-root': { color: 'white', px: 0 },
                            '& input::placeholder': { color: '#FFFFFF66', opacity: 1 },
                            '& .MuiSvgIcon-root': { color: '#FFFFFF66' },
                          }}
                        >
                          <GameSearch
                            onGameLinked={handleGameLinked}
                            onError={(err) =>
                              setAlert({
                                open: true,
                                type: 'error',
                                message: err.response?.data || 'Error linking game',
                              })
                            }
                            placeholder="Search for a game..."
                          />
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* Date picker (edit mode only) */}
                  {editMode && (
                    <Box>
                      <Typography sx={labelSx}>Recorded Date</Typography>
                      <DateField
                        selectedDate={selectedDate}
                        selectedTime={selectedTime}
                        onDateChange={(d) => {
                          setSelectedDate(d)
                          setUpdatable(true)
                        }}
                        onTimeChange={(t) => {
                          setSelectedTime(t)
                          setUpdatable(true)
                        }}
                      />
                    </Box>
                  )}

                  {/* Description */}
                  {(editMode || description) && (
                    <Box>
                      {editMode ? (
                        <TextField
                          fullWidth
                          multiline
                          rows={4}
                          size="small"
                          placeholder="Enter a video description..."
                          value={description || ''}
                          onChange={(e) => handleDescriptionChange(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          sx={inputSx}
                        />
                      ) : (
                        <Typography sx={{ fontSize: 14, color: '#FFFFFF', lineHeight: 1.6 }}>{description}</Typography>
                      )}
                    </Box>
                  )}

                  {/* Share link */}
                  <Box>
                    <Typography sx={labelSx}>Share</Typography>
                    <Box sx={{ ...rowBoxSx, gap: 0.5 }}>
                      <Typography
                        sx={{
                          flex: 1,
                          fontSize: 12,
                          color: '#FFFFFF66',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontFamily: 'monospace',
                        }}
                      >
                        {`${PURL}${vid.video_id}`}
                      </Typography>
                      <Tooltip title="Copy link">
                        <IconButton
                          size="small"
                          onMouseDown={handleMouseDown}
                          onClick={() => {
                            copyToClipboard(`${PURL}${vid.video_id}`)
                            setAlert({ type: 'info', message: 'Link copied to clipboard', open: true })
                          }}
                          sx={{ color: '#FFFFFF66', '&:hover': { color: 'white' }, p: 0.5, flexShrink: 0 }}
                        >
                          <ContentCopyIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>

                  {/* Spacer — future "Related Videos" will live here */}
                  <Box sx={{ flex: 1 }} />
                </Box>

                <Divider sx={{ borderColor: '#FFFFFF14', flexShrink: 0 }} />

                {/* Action buttons footer */}
                <Box
                  sx={{
                    px: 2.5,
                    py: 2,
                    flexShrink: 0,
                    display: 'flex',
                    gap: 1,
                    flexWrap: 'wrap',
                  }}
                >
                  {authenticated && (
                    <Tooltip title={privateView ? 'Make public' : 'Make private'}>
                      <IconButton
                        size="small"
                        onClick={handlePrivacyChange}
                        sx={{ ...actionBtnSx, color: privateView ? '#FF6B6B' : '#FFFFFFB3' }}
                      >
                        {privateView ? (
                          <VisibilityOffIcon sx={{ fontSize: 20 }} />
                        ) : (
                          <VisibilityIcon sx={{ fontSize: 20 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                  )}

                  <Tooltip title="Copy timestamp">
                    <IconButton size="small" onClick={copyTimestamp} sx={actionBtnSx}>
                      <AccessTimeIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>

                  {authenticated &&
                    (editMode ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={updateable ? update : () => setEditMode(false)}
                        sx={{
                          ml: 'auto',
                          fontSize: 12,
                          fontWeight: 400,
                          color: updateable ? '#3399FF' : '#FFFFFF',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          borderColor: updateable ? '#3399FF88' : '#FFFFFF44',
                          '&:hover': {
                            borderColor: updateable ? '#3399FF' : '#FFFFFF99',
                            bgcolor: updateable ? '#3399FF11' : '#FFFFFF11',
                          },
                          ...(updateable && { animation: 'blink-blue 0.5s ease-in-out infinite alternate' }),
                        }}
                      >
                        Save
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        onClick={() => setEditMode(true)}
                        variant="outlined"
                        sx={{
                          ml: 'auto',
                          fontSize: 12,
                          fontWeight: 400,
                          color: '#FFFFFF',
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          borderColor: '#FFFFFF44',
                          borderRadius: '8px',
                          '&:hover': { borderColor: '#FFFFFF99', bgcolor: '#FFFFFF11' },
                        }}
                      >
                        Edit
                      </Button>
                    ))}
                </Box>
              </Box>
            </Paper>
          </motion.div>
        </Box>
      </Modal>
    </>
  )
}

export default VideoModal
