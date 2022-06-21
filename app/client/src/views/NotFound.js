import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services'
import Navbar from '../components/nav/Navbar'
import { Grid, Paper, Typography } from '@mui/material'

const NotFound = ({ title, body, authenticated }) => {
  return (
    <Navbar authenticated={authenticated}>
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
    </Navbar>
  )
}

export default NotFound
