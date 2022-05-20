import React from 'react'
import { useNavigate } from 'react-router-dom'

import { Grid, Stack, Typography, TextField, Button } from '@mui/material'

import PropTypes from 'prop-types'

import { AuthService } from '../../services'
import SnackbarAlert from '../alert/SnackbarAlert'

const LoginForm = function ({ sx }) {
  const [username, setUsername] = React.useState(null)
  const [password, setPassword] = React.useState(null)
  const [alert, setAlert] = React.useState({})
  const navigate = useNavigate()

  async function login() {
    if (!username || !password) {
      setAlert({
        type: 'error',
        message: 'A Username & Password are required.',
      })
    }
    setAlert({})
    try {
      await AuthService.login(username, password)
      navigate('/')
    } catch (err) {
      const { status } = err.response
      if (status === 401) {
        setAlert({
          type: 'warning',
          message: err.response.data,
        })
      } else {
        setAlert({
          type: 'error',
          message: 'An unknown error occurred while trying to log in',
        })
      }
    }
  }

  const handleLogin = (ev) => {
    if (ev.type === 'keypress') {
      if (ev.key === 'Enter' && password) {
        ev.preventDefault()
        login()
      }
    } else {
      ev.preventDefault()
      login()
    }
  }

  const handleLoginChange = (e) => {
    setAlert({})
    setUsername(e.target.value)
  }

  return (
    <Grid container direction="column" justifyContent="flex-end" alignItems="center" sx={{ p: 2, ...sx }}>
      <SnackbarAlert severity={alert.type}>{alert.message}</SnackbarAlert>
      <Grid item sx={{ mb: 1 }}>
        <Typography variant="h2" align="center">
          Fireshare
        </Typography>
      </Grid>
      <Grid item>
        <Typography variant="body1" sx={{ fontSize: 14, fontWeight: 400 }} align="center">
          Enter your account details to sign in
        </Typography>
      </Grid>
      <Grid
        container
        justifyContent="center"
        sx={{
          width: 384,
        }}
        spacing={1}
      >
        <Grid item xs={12} sx={{ mt: 4, mb: 1 }}>
          <TextField
            fullWidth
            id="username"
            label="Username"
            variant="outlined"
            placeholder="Username"
            onKeyPress={handleLogin}
            onChange={handleLoginChange}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            id="password"
            label="Password"
            variant="outlined"
            type="password"
            placeholder="Password"
            onKeyPress={handleLogin}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Grid>
        <Grid item xs={12} sx={{ mt: 1 }}>
          <Stack spacing={2}>
            <Button variant="contained" size="large" sx={{ width: '100%' }} disabled={!password} onClick={handleLogin}>
              Sign in
            </Button>
          </Stack>
        </Grid>
      </Grid>
    </Grid>
  )
}

LoginForm.propTypes = {
  sx: PropTypes.objectOf(PropTypes.any),
}
LoginForm.defaultProps = {
  sx: {},
}

export default LoginForm
