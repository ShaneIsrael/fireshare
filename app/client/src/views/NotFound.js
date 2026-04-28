import React from 'react'
import { Grid, Paper, Typography } from '@mui/material'
import { DisableDragDrop } from '../components/utils/GlobalDragDropOverlay'

const NotFound = ({ title, body }) => {
  return (
    <DisableDragDrop>
      <Paper square sx={{ overflow: 'auto' }}>
        <Grid
          sx={{ height: 'calc(100vh - 65px)' }}
          container
          direction="row"
          justifyContent="center"
          alignItems="center"
        >
          <Grid item>
            <Typography align="center" variant="h1">
              {title || '404'}
            </Typography>
            <Typography align="center" variant="h3">
              {body || 'Page Not Found'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </DisableDragDrop>
  )
}

export default NotFound
