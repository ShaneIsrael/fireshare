import React from 'react'
import { Route, HashRouter as Router, Routes } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import Login from './views/Login'
import Watch from './views/Watch'
import Dashboard from './views/Dashboard'
import NotFound from './views/NotFound'
import darkTheme from './common/darkTheme'

const muitheme = createTheme(darkTheme)

export default function App() {
  return (
    <Router>
      <ThemeProvider theme={muitheme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/w/:id" element={<Watch />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ThemeProvider>
    </Router>
  )
}
