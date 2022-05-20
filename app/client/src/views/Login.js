import React from 'react'

import { Box, Grid, Paper } from '@mui/material'

import LoginForm from '../components/forms/LoginForm'
import { AuthService } from '../services'
import { useNavigate } from 'react-router-dom'

const Login = function () {
  const navigate = useNavigate()

  React.useEffect(() => {
    async function isLoggedIn() {
      try {
        if ((await AuthService.isLoggedIn()).data) {
          navigate('/')
        }
      } catch (err) {
        console.log(err)
      }
    }
    isLoggedIn()
  }, [navigate])

  return (
    <Box component="main" sx={{ height: '100vh' }}>
      <Paper square sx={{ overflow: 'auto' }}>
        <Grid sx={{ height: '100vh' }} container direction="row" justifyContent="center" alignItems="center">
          <Grid item>
            <LoginForm />
          </Grid>
        </Grid>
      </Paper>
    </Box>
  )
}

Login.propTypes = {}

export default Login
