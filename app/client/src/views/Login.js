import React from 'react'

import { Box, Grid } from '@mui/material'

import LoginForm from '../components/forms/LoginForm'
import { Navigate } from 'react-router-dom'
import { DisableDragDrop } from '../components/utils/GlobalDragDropOverlay'

const Login = function ({ authenticated }) {
  if (authenticated) return <Navigate to="/" />

  return (
    <DisableDragDrop>
      <Box square sx={{ overflow: 'auto' }}>
        <Grid sx={{ height: '100%' }} container direction="row" justifyContent="center" alignItems="center">
          <Grid item>
            <LoginForm />
          </Grid>
        </Grid>
      </Box>
    </DisableDragDrop>
  )
}

Login.propTypes = {}

export default Login
