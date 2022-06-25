import React from 'react'

import { Box, Grid } from '@mui/material'

import LoginForm from '../components/forms/LoginForm'
import { Navigate } from 'react-router-dom'

const Login = function ({ authenticated }) {
  if (authenticated) return <Navigate to="/" />

  return (
    <Box square sx={{ overflow: 'auto' }}>
      <Grid sx={{ height: '100%' }} container direction="row" justifyContent="center" alignItems="center">
        <Grid item>
          <LoginForm />
        </Grid>
      </Grid>
    </Box>
  )
}

Login.propTypes = {}

export default Login
