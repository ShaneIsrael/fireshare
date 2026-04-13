import * as React from 'react'
import { Box, Grid, IconButton, Typography } from '@mui/material'
import LightTooltip from '../misc/LightTooltip'
import GitHubIcon from '@mui/icons-material/GitHub'
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism'
import BugReportIcon from '@mui/icons-material/BugReport'

function VersionBox({ open }) {
  if (!open)
    return (
      <Box
        sx={{
          display: 'flex',
          width: 42,
          m: 1,
          height: 40,
          border: '1px solid rgba(194, 224, 255, 0.18)',
          borderRadius: '8px',
          ':hover': {
            backgroundColor: 'rgba(194, 224, 255, 0.08)',
            cursor: 'pointer',
          },
        }}
        justifyContent="center"
        alignItems="center"
        onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
      >
        <IconButton aria-label="report-bug-link" sx={{ p: 0.5, pointerEvents: 'all' }}>
          <GitHubIcon sx={{ color: '#EBEBEB' }} />
        </IconButton>
      </Box>
    )
  return (
    <Box
      sx={{
        width: 222,
        m: 1,
        height: 40,
        border: '1px solid rgba(194, 224, 255, 0.18)',
        borderRadius: '8px',
        ':hover': {
          backgroundColor: 'rgba(194, 224, 255, 0.08)',
          cursor: 'pointer',
        },
      }}
      onClick={() => window.open('https://github.com/ShaneIsrael/fireshare', '_blank')}
    >
      <Grid container alignItems="center" sx={{ height: '100%' }}>
        <Grid item sx={{ ml: 1, mr: 1 }}>
          <IconButton aria-label="report-bug-link" sx={{ p: 0.5, pointerEvents: 'all' }}>
            <GitHubIcon sx={{ color: '#EBEBEB' }} />
          </IconButton>
        </Grid>
        <Grid container item direction="column" xs>
          <Grid item>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#EBEBEB' }}>
              Fireshare
            </Typography>
          </Grid>
          <Grid item>
            <Typography sx={{ fontFamily: 'monospace', fontWeight: 600, fontSize: 12, color: '#2684FF' }}>
              v{import.meta.env.VITE_VERSION}
            </Typography>
          </Grid>
        </Grid>
        <Grid container item xs>
          <LightTooltip arrow title="Found a bug? Report it here.">
            <IconButton
              aria-label="report-bug-link"
              size="medium"
              sx={{ p: 0.5, mr: 1, pointerEvents: 'all' }}
              onClick={(e) => {
                e.stopPropagation()
                window.open('https://github.com/ShaneIsrael/fireshare/issues', '_blank')
              }}
            >
              <BugReportIcon fontSize="inherit" />
            </IconButton>
          </LightTooltip>
          <LightTooltip arrow title="Buy us a coffee!">
            <IconButton
              aria-label="paypal-link"
              size="medium"
              sx={{ p: 0.5, pointerEvents: 'all' }}
              onClick={(e) => {
                e.stopPropagation()
                window.open('https://buymeacoffee.com/shaneisrael', '_blank')
              }}
            >
              <VolunteerActivismIcon fontSize="inherit" />
            </IconButton>
          </LightTooltip>
        </Grid>
      </Grid>
    </Box>
  )
}

export default VersionBox
