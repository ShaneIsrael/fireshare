import * as React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import LightTooltip from '../misc/LightTooltip'
import GitHubIcon from '@mui/icons-material/GitHub'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import BugReportIcon from '@mui/icons-material/BugReport'
import NewReleasesIcon from '@mui/icons-material/NewReleases'

const GITHUB_URL = 'https://github.com/ShaneIsrael/fireshare'
const ISSUES_URL = 'https://github.com/ShaneIsrael/fireshare/issues'
const COFFEE_URL = 'https://buymeacoffee.com/shaneisrael'

const actionIconSx = {
  p: 0.75,
  color: 'rgba(194, 224, 255, 0.5)',
  borderRadius: '6px',
  '&:hover': {
    color: '#EBEBEB',
    backgroundColor: 'rgba(194, 224, 255, 0.1)',
  },
}

function VersionBox({ open, releaseNotes, onUpdateClick }) {
  const hasUpdate = Boolean(releaseNotes)

  if (!open)
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <LightTooltip arrow title={`Fireshare v${import.meta.env.VITE_VERSION}`} placement="right">
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 42,
              height: 40,
              m: 1,
              mb: hasUpdate ? 0.5 : 1,
              border: '1px solid rgba(194, 224, 255, 0.18)',
              borderRadius: '8px',
              color: 'rgba(194, 224, 255, 0.5)',
              cursor: 'pointer',
              '&:hover': {
                backgroundColor: 'rgba(194, 224, 255, 0.08)',
                color: '#EBEBEB',
              },
            }}
            onClick={() => window.open(GITHUB_URL, '_blank')}
          >
            <GitHubIcon fontSize="small" />
          </Box>
        </LightTooltip>
        {hasUpdate && (
          <LightTooltip arrow title="Update available! Click to see what's new." placement="right">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 40,
                m: 1,
                mt: 0,
                border: '1px solid rgba(255, 179, 0, 0.4)',
                borderRadius: '8px',
                color: '#FFB300',
                cursor: 'pointer',
                '&:hover': {
                  backgroundColor: 'rgba(255, 179, 0, 0.1)',
                  color: '#FFC107',
                },
              }}
              onClick={onUpdateClick}
            >
              <NewReleasesIcon fontSize="small" />
            </Box>
          </LightTooltip>
        )}
      </Box>
    )

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
      {/* Left: GitHub link + version */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          flex: 1,
          minWidth: 0,
          px: 1.25,
          height: '100%',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'rgba(194, 224, 255, 0.08)',
          },
        }}
        onClick={() => window.open(GITHUB_URL, '_blank')}
      >
        <GitHubIcon sx={{ fontSize: 16, color: 'rgba(194, 224, 255, 0.6)', flexShrink: 0 }} />
        <Typography
          sx={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 12,
            color: '#2684FF',
            letterSpacing: '0.04em',
            userSelect: 'none',
          }}
        >
          v{import.meta.env.VITE_VERSION}
        </Typography>
      </Box>

      {/* Divider */}
      <Box sx={{ width: '1px', height: 24, bgcolor: 'rgba(194, 224, 255, 0.12)', flexShrink: 0 }} />

      {/* Right: action icons */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 0.5, gap: 0.25 }}>
        {hasUpdate && (
          <LightTooltip arrow title="Update available! Click to see what's new.">
            <IconButton
              aria-label="update-available"
              size="small"
              sx={{
                ...actionIconSx,
                color: '#FFB300',
                '&:hover': { color: '#FFC107', backgroundColor: 'rgba(255, 179, 0, 0.1)' },
              }}
              onClick={onUpdateClick}
            >
              <NewReleasesIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </LightTooltip>
        )}
        <LightTooltip arrow title="Found a bug? Report it here.">
          <IconButton
            aria-label="report-bug-link"
            size="small"
            sx={actionIconSx}
            onClick={() => window.open(ISSUES_URL, '_blank')}
          >
            <BugReportIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </LightTooltip>
        <LightTooltip arrow title="Buy us a coffee!">
          <IconButton
            aria-label="paypal-link"
            size="small"
            sx={actionIconSx}
            onClick={() => window.open(COFFEE_URL, '_blank')}
          >
            <VolunteerActivismIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </LightTooltip>
      </Box>
    </Box>
  )
}

export default VersionBox
