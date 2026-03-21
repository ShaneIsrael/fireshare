import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, CircularProgress, Button, Menu, MenuItem } from '@mui/material'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import WaveSurfer from 'wavesurfer.js'
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js'
import { getUrl } from '../../common/utils'

const labelSx = { fontSize: 11, color: '#FFFFFFB3', mb: 0.5, textTransform: 'uppercase', letterSpacing: '0.08em' }

const numInputSx = {
  width: 80,
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: '6px',
  color: 'white',
  fontSize: 13,
  fontFamily: 'monospace',
  padding: '4px 8px',
  outline: 'none',
  '&:focus': { borderColor: '#3399FF' },
}

/**
 * WaveformCropper — renders an audio waveform for the original (unmodified) video
 * with a draggable/resizable region marking the crop start and end points.
 *
 * Props:
 *   videoId    — video ID used to build /api/video/original?id={videoId}
 *   duration   — original video duration in seconds (used as fallback)
 *   startTime  — current crop start (null = full start)
 *   endTime    — current crop end   (null = full end)
 *   onChange   — ({ startTime: number|null, endTime: number|null }) => void
 */
const WaveformCropper = React.forwardRef(
  ({ videoId, duration, startTime, endTime, onChange, onSeek, getCurrentTime }, ref) => {
    const containerRef = useRef(null)
    const wsRef = useRef(null)
    const regionsPluginRef = useRef(null)
    const regionRef = useRef(null)
    const onSeekRef = useRef(onSeek)
    const getCurrentTimeRef = useRef(getCurrentTime)
    const zoomRef = useRef(1)
    const minZoomRef = useRef(1)
    const isReadyRef = useRef(false)
    const cursorTimeRef = useRef(0)

    const [contextMenu, setContextMenu] = useState(null) // { x, y, cursorTime } | null

    useEffect(() => {
      onSeekRef.current = onSeek
    }, [onSeek])
    useEffect(() => {
      getCurrentTimeRef.current = getCurrentTime
    }, [getCurrentTime])

    // Expose a seekTo(time) handle so VideoModal can sync the cursor with video playback
    React.useImperativeHandle(
      ref,
      () => ({
        seekTo: (time) => {
          const ws = wsRef.current
          if (!ws || !isReadyRef.current) return
          const total = ws.getDuration()
          if (!total) return
          cursorTimeRef.current = time
          ws.seekTo(Math.max(0, Math.min(1, time / total)))
        },
      }),
      [],
    )

    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [localStart, setLocalStart] = useState(startTime ?? 0)
    const [localEnd, setLocalEnd] = useState(endTime ?? duration ?? 0)
    const [totalDuration, setTotalDuration] = useState(duration ?? 0)

    // Emit null when values are trivially close to full range
    const toNullable = (s, e, total) => ({
      startTime: s <= 0.05 ? null : s,
      endTime: e >= total - 0.05 ? null : e,
    })

    useEffect(() => {
      if (!containerRef.current) return

      const regionsPlugin = RegionsPlugin.create()
      regionsPluginRef.current = regionsPlugin

      const ws = WaveSurfer.create({
        container: containerRef.current,
        waveColor: '#FFFFFF30',
        progressColor: '#3399FF55',
        cursorColor: 'rgba(255, 255, 255, 0.85)',
        cursorWidth: 2,
        height: 64,
        normalize: true,
        interact: false,
        autoScroll: false,
        autoCenter: false,
        barWidth: 2,
        barGap: 1,
        barRadius: 3,
        barAlign: 'bottom',
        url: `${getUrl()}/api/video/original?id=${videoId}`,
        fetchParams: { credentials: 'include' },
        plugins: [regionsPlugin],
      })
      wsRef.current = ws

      ws.on('error', () => {
        setIsLoading(false)
        setLoadError(true)
      })

      ws.on('ready', () => {
        isReadyRef.current = true
        const total = ws.getDuration()
        setTotalDuration(total)
        setIsLoading(false)

        const s = startTime ?? 0
        const e = endTime ?? total

        setLocalStart(s)
        setLocalEnd(e)

        regionRef.current = regionsPlugin.addRegion({
          start: s,
          end: e,
          color: 'rgba(51, 153, 255, 0.20)',
          drag: true,
          resize: true,
        })

        onChange(toNullable(s, e, total))

        // Sync cursor to current video playback position
        const currentVideoTime = getCurrentTimeRef.current?.() ?? 0
        if (currentVideoTime > 0 && total > 0) {
          ws.seekTo(Math.max(0, Math.min(1, currentVideoTime / total)))
        }

        // Compute the default zoom that fits the full waveform in the container
        const containerWidth = containerRef.current?.clientWidth || 500
        const fitZoom = containerWidth / total
        minZoomRef.current = fitZoom
        zoomRef.current = fitZoom
      })

      regionsPlugin.on('region-updated', (region) => {
        const total = wsRef.current?.getDuration() ?? totalDuration
        const s = parseFloat(Math.max(0, region.start).toFixed(2))
        const e = parseFloat(Math.min(total, region.end).toFixed(2))
        setLocalStart(s)
        setLocalEnd(e)
        onChange(toNullable(s, e, total))
      })

      // Click anywhere on the waveform → move seek cursor + seek video
      const container = containerRef.current
      const handleClick = (e) => {
        const ws = wsRef.current
        if (!ws || !ws.getDuration()) return
        // WaveSurfer uses a Shadow DOM internally; its inner wrapper's getBoundingClientRect()
        // automatically accounts for scroll offset (its .left goes negative when scrolled right),
        // so this gives the correct waveform-relative click position at any zoom level.
        const wrapper = ws.getWrapper()
        const rect = wrapper.getBoundingClientRect()
        const progress = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        cursorTimeRef.current = progress * ws.getDuration()
        ws.seekTo(progress)
        onSeekRef.current?.(cursorTimeRef.current)
      }

      const handleContextMenu = (e) => {
        e.preventDefault()
        setContextMenu({ x: e.clientX, y: e.clientY, cursorTime: cursorTimeRef.current })
      }

      // Vertical scroll → zoom in/out; horizontal scroll passes through naturally
      const handleWheel = (e) => {
        if (e.deltaY === 0 || !wsRef.current) return
        e.preventDefault()
        const newZoom = Math.max(minZoomRef.current, Math.min(500, zoomRef.current * (e.deltaY < 0 ? 1.3 : 0.77)))
        zoomRef.current = newZoom
        wsRef.current.zoom(newZoom)
      }

      container.addEventListener('click', handleClick)
      container.addEventListener('contextmenu', handleContextMenu)
      container.addEventListener('wheel', handleWheel, { passive: false })

      return () => {
        isReadyRef.current = false
        ws.destroy()
        container.removeEventListener('click', handleClick)
        container.removeEventListener('contextmenu', handleContextMenu)
        container.removeEventListener('wheel', handleWheel)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId])

    const handleStartChange = (val) => {
      const total = wsRef.current?.getDuration() ?? totalDuration
      const clamped = parseFloat(Math.max(0, Math.min(val, localEnd - 0.1)).toFixed(2))
      setLocalStart(clamped)
      if (regionRef.current) regionRef.current.setOptions({ start: clamped })
      onChange(toNullable(clamped, localEnd, total))
    }

    const handleEndChange = (val) => {
      const total = wsRef.current?.getDuration() ?? totalDuration
      const clamped = parseFloat(Math.min(total, Math.max(val, localStart + 0.1)).toFixed(2))
      setLocalEnd(clamped)
      if (regionRef.current) regionRef.current.setOptions({ end: clamped })
      onChange(toNullable(localStart, clamped, total))
    }

    const handleReset = () => {
      const total = wsRef.current?.getDuration() ?? totalDuration
      if (regionRef.current) regionRef.current.setOptions({ start: 0, end: total })
      setLocalStart(0)
      setLocalEnd(total)
      onChange({ startTime: null, endTime: null })
    }

    return (
      <>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'stretch' }}>
          {/* Waveform canvas — flex: 1 + minWidth: 0 prevents zoom from expanding the modal */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              position: 'relative',
              bgcolor: '#FFFFFF08',
              border: '1px solid #FFFFFF1A',
              borderRadius: '8px',
              overflow: 'hidden',
              minHeight: 64,
            }}
          >
            <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }} />
            {(isLoading || loadError) && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                }}
              >
                {loadError ? (
                  <Typography sx={{ fontSize: 12, color: '#FF6B6B66' }}>Unable to load audio waveform</Typography>
                ) : (
                  <>
                    <CircularProgress size={20} sx={{ color: '#3399FF' }} />
                    <Typography sx={{ fontSize: 12, color: '#FFFFFF66' }}>Loading audio…</Typography>
                  </>
                )}
              </Box>
            )}
          </Box>

          {/* Controls — horizontal row to the right */}
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, flexShrink: 0 }}>
            <Box>
              <Typography sx={labelSx}>Start (s)</Typography>
              <Box
                component="input"
                type="number"
                step="0.1"
                min={0}
                max={localEnd - 0.1}
                value={localStart}
                disabled={isLoading}
                onChange={(e) => handleStartChange(parseFloat(e.target.value) || 0)}
                sx={numInputSx}
              />
            </Box>
            <Box>
              <Typography sx={labelSx}>End (s)</Typography>
              <Box
                component="input"
                type="number"
                step="0.1"
                min={localStart + 0.1}
                max={totalDuration}
                value={localEnd}
                disabled={isLoading}
                onChange={(e) => handleEndChange(parseFloat(e.target.value) || totalDuration)}
                sx={numInputSx}
              />
            </Box>
            <Button
              size="small"
              variant="text"
              startIcon={<RestartAltIcon />}
              onClick={handleReset}
              disabled={isLoading}
              sx={{ color: '#FFFFFF55', '&:hover': { color: 'white' }, mt: 2.5, ml: 0.5 }}
            >
              Reset
            </Button>
          </Box>
        </Box>

        <Menu
          open={contextMenu !== null}
          onClose={() => setContextMenu(null)}
          anchorReference="anchorPosition"
          anchorPosition={contextMenu ? { top: contextMenu.y, left: contextMenu.x } : undefined}
          slotProps={{ paper: { sx: { bgcolor: '#0D1F33', border: '1px solid #FFFFFF1A', color: 'white' } } }}
        >
          <MenuItem
            disabled={contextMenu?.cursorTime >= localEnd}
            onClick={() => {
              handleStartChange(parseFloat(contextMenu.cursorTime.toFixed(2)))
              setContextMenu(null)
            }}
            sx={{ fontSize: 13, '&.Mui-disabled': { color: '#FFFFFF33' } }}
          >
            Set Start
          </MenuItem>
          <MenuItem
            disabled={contextMenu?.cursorTime <= localStart}
            onClick={() => {
              handleEndChange(parseFloat(contextMenu.cursorTime.toFixed(2)))
              setContextMenu(null)
            }}
            sx={{ fontSize: 13, '&.Mui-disabled': { color: '#FFFFFF33' } }}
          >
            Set End
          </MenuItem>
        </Menu>
      </>
    )
  },
)

export default WaveformCropper
