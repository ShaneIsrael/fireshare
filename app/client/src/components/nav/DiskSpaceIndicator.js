import * as React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import StorageIcon from '@mui/icons-material/Storage'
import RefreshIcon from '@mui/icons-material/Refresh'
import LightTooltip from '../ui/LightTooltip'
import { StatsService } from '../../services'

const actionIconSx = {
  p: 0.75,
  color: 'rgba(194, 224, 255, 0.5)',
  borderRadius: '6px',
  '&:hover': {
    color: '#EBEBEB',
    backgroundColor: 'rgba(194, 224, 255, 0.1)',
  },
}

const DiskSpaceIndicator = ({ open, visible }) => {
  const [folderSize, setFolderSize] = React.useState(null)
  const [refreshing, setRefreshing] = React.useState(false)

  const fetchFolderSize = React.useCallback(async () => {
    try {
      const data = await StatsService.getFolderSize()
      setFolderSize(data.size_pretty)
    } catch (error) {
      console.error('Error fetching folder size:', error)
    }
  }, [])

  React.useEffect(() => {
    if (visible) fetchFolderSize()
  }, [visible, fetchFolderSize])

  const handleRefresh = async (e) => {
    e.stopPropagation()
    setRefreshing(true)
    await fetchFolderSize()
    setRefreshing(false)
  }

  if (!visible) return null

  const loading = folderSize === null

  if (!open) {
    return (
      <LightTooltip arrow title={loading ? 'Loading disk usage…' : `Disk Usage: ${folderSize}`} placement="right">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 42,
            height: 40,
            m: 1,
            border: '1px solid rgba(194, 224, 255, 0.18)',
            borderRadius: '8px',
            color: 'rgba(194, 224, 255, 0.5)',
            cursor: 'default',
            '&:hover': {
              backgroundColor: 'rgba(194, 224, 255, 0.08)',
              color: '#EBEBEB',
            },
          }}
        >
          <StorageIcon fontSize="small" sx={{ ...(loading && { opacity: 0.4 }) }} />
        </Box>
      </LightTooltip>
    )
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        width: 222,
        height: 40,
        m: 1,
        border: '1px solid rgba(194, 224, 255, 0.18)',
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Left: icon + label + value */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flex: 1,
          minWidth: 0,
          px: 1.25,
          height: '100%',
        }}
      >
        <StorageIcon sx={{ fontSize: 16, color: 'rgba(194, 224, 255, 0.6)', flexShrink: 0 }} />
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 600,
            fontSize: 12,
            color: 'rgba(194, 224, 255, 0.6)',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          Disk
        </Typography>
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 12,
            color: loading ? 'rgba(194, 224, 255, 0.3)' : '#2684FF',
            letterSpacing: '0.04em',
            userSelect: 'none',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? '—' : folderSize}
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ width: '1px', height: 24, bgcolor: 'rgba(194, 224, 255, 0.12)', flexShrink: 0 }} />

      {/* Right: refresh */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5 }}>
        <LightTooltip arrow title="Refresh disk usage">
          <IconButton
            aria-label="refresh-disk-usage"
            size="small"
            disabled={refreshing}
            sx={{
              ...actionIconSx,
              ...(refreshing && {
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }),
            }}
            onClick={handleRefresh}
          >
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </LightTooltip>
      </Box>
    </Box>
  )
}

export default DiskSpaceIndicator
