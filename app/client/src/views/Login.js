import React from 'react'
import { Box } from '@mui/material'
import LoginForm from '../components/forms/LoginForm'
import { Navigate } from 'react-router-dom'
import { DisableDragDrop } from '../components/utils/GlobalDragDropOverlay'

const Login = function ({ authenticated }) {
  if (authenticated) return <Navigate to="/" />

  return (
    <DisableDragDrop>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100%',
          px: 2,
          // Subtle radial glow anchored top-center, matching the app's blue palette
          background: `
            radial-gradient(ellipse 80% 50% at 50% -10%, rgba(38, 132, 255, 0.12) 0%, transparent 70%),
            #001E3C
          `,
        }}
      >
        <LoginForm />
      </Box>
    </DisableDragDrop>
  )
}

export default Login
