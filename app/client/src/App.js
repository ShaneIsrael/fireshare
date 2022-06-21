import React from 'react'
import { Route, HashRouter as Router, Routes } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import Login from './views/Login'
import Watch from './views/Watch'
import Dashboard from './views/Dashboard'
import NotFound from './views/NotFound'
import Settings from './views/Settings'
import Feed from './views/Feed'
import darkTheme from './common/darkTheme'
import { ConfigService } from './services'
import { setSetting } from './common/utils'
import AuthWrapper from './components/utils/AuthWrapper'

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
          <Route
            path="/"
            element={
              <AuthWrapper redirect={'/feed'}>
                <Dashboard />
              </AuthWrapper>
            }
          />
          <Route
            path="/feed"
            element={
              <AuthWrapper>
                <Feed />
              </AuthWrapper>
            }
          />
          <Route
            path="/login"
            element={
              <AuthWrapper>
                <Login />
              </AuthWrapper>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthWrapper redirect={'/login'}>
                <Settings />
              </AuthWrapper>
            }
          />
          <Route
            path="/w/:id"
            element={
              <AuthWrapper>
                <Watch />
              </AuthWrapper>
            }
          />
          <Route
            path="*"
            element={
              <AuthWrapper>
                <NotFound />
              </AuthWrapper>
            }
          />
        </Routes>
      </ThemeProvider>
    </Router>
  )
}
