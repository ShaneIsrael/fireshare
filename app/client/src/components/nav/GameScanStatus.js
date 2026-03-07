import * as React from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import SyncIcon from '@mui/icons-material/Sync'
import adminSSE from '../../services/AdminSSE'

const spinAnimation = {
  animation: 'spin 1s linear infinite',
  '@keyframes spin': {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  }
}

const GameScanStatus = ({ open, onComplete }) => {
  const [scanStatus, setScanStatus] = React.useState(null)
  const wasRunningRef = React.useRef(false)
  const onCompleteRef = React.useRef(onComplete)

  React.useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  React.useEffect(() => {
    const unsubscribe = adminSSE.subscribeGameScan((data) => {
      if (data.is_running) {
        wasRunningRef.current = true
        setScanStatus(data)
      } else if (wasRunningRef.current) {
        // Scan just finished
        wasRunningRef.current = false
        onCompleteRef.current?.(data)
        setScanStatus(null)
      }
    })
    return unsubscribe
  }, [])

  if (!scanStatus) return null

  if (open) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          pl: 2,
          pr: 2,
          pb: 1,
          overflow: 'hidden',
        }}
      >
        <SyncIcon
          sx={{
            color: '#2684FF',
            mr: 1,
            fontSize: 18,
            flexShrink: 0,
            mt: 0.25,
            ...spinAnimation,
          }}
        />
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 15,
            color: '#EBEBEB',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
          }}
        >
          {scanStatus.total === 0 ? (
            'Preparing scan...'
          ) : (
            <>
              Scanning for games{' '}
              <Box component="span" sx={{ color: '#2684FF' }}>
                {scanStatus.current}/{scanStatus.total}
              </Box>
            </>
          )}
        </Typography>
      </Box>
    )
  }

  const tooltipText = scanStatus.total === 0
    ? 'Preparing scan...'
    : `Scanning: ${scanStatus.current}/${scanStatus.total}`

  return (
    <Tooltip title={tooltipText} arrow placement="right">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          pb: 1,
        }}
      >
        <SyncIcon
          sx={{
            color: '#2684FF',
            fontSize: 18,
            ...spinAnimation,
          }}
        />
      </Box>
    </Tooltip>
  )
}

export default GameScanStatus
