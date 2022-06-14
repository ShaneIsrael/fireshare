import React from 'react'
import { Route, HashRouter as Router, Routes } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import Login from './views/Login'
import Watch from './views/Watch'
import Dashboard from './views/Dashboard'
import NotFound from './views/NotFound'
import darkTheme from './common/darkTheme'
import Feed from './views/Feed'
import { ConfigService } from './services'
import { setSetting } from './common/utils'

const muitheme = createTheme(darkTheme)

export default function App() {
  React.useEffect(() => {
    ConfigService.getConfig()
      .then((res) => res.data)
      .then((config) => {
        setSetting('ui_config', config)
      })
      .catch((err) => console.error(err))
  })
  return (
    <Router>
      <ThemeProvider theme={muitheme}>
        <CssBaseline />
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/feed" element={<Feed />} />
          <Route path="/login" element={<Login />} />
          <Route path="/w/:id" element={<Watch />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ThemeProvider>
    </Router>
  )
}
