import React, { useEffect, useRef, useState } from 'react'
import { Box, Typography, CircularProgress, Button } from '@mui/material'
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
const WaveformCropper = ({ videoId, duration, startTime, endTime, onChange }) => {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const regionsPluginRef = useRef(null)
  const regionRef = useRef(null)

  const [isLoading, setIsLoading] = useState(true)
  const [localStart, setLocalStart] = useState(startTime ?? 0)
  const [localEnd, setLocalEnd] = useState(endTime ?? duration ?? 0)
  const [totalDuration, setTotalDuration] = useState(duration ?? 0)

  // Emit null when values are trivially close to full range
  const toNullable = (s, e, total) => ({
    startTime: s <= 0.05 ? null : s,
    endTime:   e >= total - 0.05 ? null : e,
  })

  useEffect(() => {
    if (!containerRef.current) return

    const regionsPlugin = RegionsPlugin.create()
    regionsPluginRef.current = regionsPlugin

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#FFFFFF30',
      progressColor: '#3399FF55',
      cursorColor: 'transparent',
      height: 64,
      normalize: true,
      interact: false,
      url: `${getUrl()}/api/video/original?id=${videoId}`,
      plugins: [regionsPlugin],
    })
    wsRef.current = ws

    ws.on('ready', () => {
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
    })

    regionsPlugin.on('region-updated', (region) => {
      const total = wsRef.current?.getDuration() ?? totalDuration
      const s = parseFloat(Math.max(0, region.start).toFixed(2))
      const e = parseFloat(Math.min(total, region.end).toFixed(2))
      setLocalStart(s)
      setLocalEnd(e)
      onChange(toNullable(s, e, total))
    })

    return () => {
      ws.destroy()
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
    <Box>
      {/* Waveform canvas */}
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#FFFFFF08',
          border: '1px solid #FFFFFF1A',
          borderRadius: '8px',
          overflow: 'hidden',
          minHeight: 64,
        }}
      >
        <div ref={containerRef} style={{ width: '100%' }} />
        {isLoading && (
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
            <CircularProgress size={20} sx={{ color: '#3399FF' }} />
            <Typography sx={{ fontSize: 12, color: '#FFFFFF66' }}>Loading audio…</Typography>
          </Box>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, mt: 1.5, flexWrap: 'wrap' }}>
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
          sx={{ color: '#FFFFFF55', mb: 0.25, '&:hover': { color: 'white' } }}
        >
          Reset
        </Button>
      </Box>

      <Typography sx={{ fontSize: 11, color: '#FFFFFF44', mt: 1 }}>
        Drag the highlighted region or edit the values above. Save to apply the crop.
      </Typography>
    </Box>
  )
}

export default WaveformCropper
