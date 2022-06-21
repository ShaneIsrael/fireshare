import React from 'react'

import { Box, Grid } from '@mui/material'

import LoginForm from '../components/forms/LoginForm'
import { AuthService } from '../services'
import { Navigate, useNavigate } from 'react-router-dom'

const Login = function ({ authenticated }) {
  if (authenticated) return <Navigate to="/" />

  return (
    <Box component="main" sx={{ height: '100vh' }}>
      <Box square sx={{ overflow: 'auto' }}>
        <Grid sx={{ height: '100vh' }} container direction="row" justifyContent="center" alignItems="center">
          <Grid item>
            <LoginForm />
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

Login.propTypes = {}

export default Login
