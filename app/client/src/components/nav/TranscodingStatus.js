import * as React from 'react'
import { Grid, Box, IconButton } from '@mui/material'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import { motion } from 'framer-motion'
import adminSSE from '../../services/AdminSSE'
import SyncIcon from '@mui/icons-material/Sync'

const TranscodingStatus = ({ open }) => {
  const [status, setStatus] = React.useState(null)
  const [stoppedMessage, setStoppedMessage] = React.useState(null)

  React.useEffect(() => {
    const handleCancel = () => {
      setStatus(null)
      setStoppedMessage('Transcoding stopped')
      setTimeout(() => setStoppedMessage(null), 3000)
    }
    window.addEventListener('transcodingCancelled', handleCancel)
    return () => {
      window.removeEventListener('transcodingCancelled', handleCancel)
    }
  }, [])

  React.useEffect(() => {
    return adminSSE.subscribeTranscoding((data) => {
      setStatus(data?.is_running ? data : null)
    })
  }, [])

  if (!status && !stoppedMessage) return null

  if (stoppedMessage && open) {
    return (
      <>
        <Box
          sx={{
            width: 222,
            m: 1,
            px: 2,
            py: 1.5,
            border: '1px solid rgba(194, 224, 255, 0.18)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            color: '#EBEBEB',
            fontWeight: 600,
            fontSize: 13,
            backgroundColor: 'transparent',
            ':hover': {
              backgroundColor: 'rgba(194, 224, 255, 0.08)',
            },
          }}
        >
          <Grid container alignItems="center">
            <Grid item>
              <Typography
                sx={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  fontSize: 12,
                  color: '#EBEBEB',
                }}
              >
                {stoppedMessage}
              </Typography>
            </Grid>
          </Grid>
        </Box>
      </>
    )
  }

  if (open) {
    return (
      <>
        <Tooltip title={status.current_video || 'Not transcoding'} arrow placement="right">
          <Box
            sx={{
              width: 222,
              m: 1,
              px: 2,
              py: 1.5,
              border: '1px solid rgba(194, 224, 255, 0.18)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              color: '#EBEBEB',
              fontWeight: 600,
              fontSize: 13,
              backgroundColor: 'transparent',
              ':hover': {
                backgroundColor: 'rgba(194, 224, 255, 0.08)',
              },
            }}
          >
            <Grid container alignItems="center">
              <Grid item sx={{
                overflow: 'hidden'
              }}>
                <Typography
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 600,
                    fontSize: 12,
                    color: '#EBEBEB',
                  }}
                >
                  {status.total === 0 ? (
                    'Preparing transcode...'
                  ) : (
                    <>
                      Transcoding:{' '}
                      <Box component="span" sx={{ color: '#2684FF' }}>
                        {status.current}/{status.total}
                      </Box>
                    </>
                  )}
                </Typography>
                {status.current_video && (
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: '#999',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {status.current_video}
                  </Typography>
                )}
                {typeof status.percent === 'number' && (
                  <Box sx={{ mt: 1, width: '100%' }}>
                    <Box
                      sx={{
                        width: '100%',
                        height: 4,
                        borderRadius: 2,
                        backgroundColor: 'rgba(194, 224, 255, 0.1)',
                        overflow: 'hidden',
                      }}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${status.percent}%` }}
                        transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
                        style={{
                          height: '100%',
                          backgroundColor: '#2684FF',
                          borderRadius: 4,
                        }}
                      />
                    </Box>
                    <Typography sx={{ fontSize: 10, color: '#999', mt: 0.5 }}>
                      {status.percent.toFixed(0)}%{status.speed ? ` • ${status.speed}x` : ''}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          </Box>
        </Tooltip >
      </>
    )
  }

  const tooltipText = status.total === 0
    ? 'Preparing transcode...'
    : `Transcoding: ${status.current}/${status.total}${status.current_video ? `\n${status.current_video}` : ''}`

  return (
    <>
      <Tooltip title={tooltipText} arrow placement="right">
        <Box
          sx={{
            width: 42,
            m: 1,
            height: 40,
            border: '1px solid rgba(194, 224, 255, 0.18)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            ':hover': {
              backgroundColor: 'rgba(194, 224, 255, 0.08)',
            },
          }}
        >
          <Typography
            sx={{
              fontFamily: 'monospace',
              fontWeight: 600,
              fontSize: 15,
              color: '#EBEBEB',
            }}
          >
            <IconButton sx={{ p: 0.5, pointerEvents: 'all' }}>
              <SyncIcon sx={{
                color: '#EBEBEB',
                animation: 'spin 1.5s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(360deg)' },
                  '100%': { transform: 'rotate(0deg)' },
                },
              }} />
            </IconButton>
          </Typography>
        </Box>
      </Tooltip>
    </>
  )
}

export default TranscodingStatus
