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
import { getSetting, setSetting } from './common/utils'
import AuthWrapper from './components/utils/AuthWrapper'
import Navbar20 from './components/nav/Navbar20'

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

  const drawerOpen = getSetting('drawerOpen') === undefined ? true : getSetting('drawerOpen')

  return (
    <Router>
      <ThemeProvider theme={muitheme}>
        <CssBaseline />
        <Routes>
          <Route
            path="/"
            element={
              <AuthWrapper redirect={'/feed'}>
                <Navbar20 page="/" collapsed={!drawerOpen} searchable styleToggle cardSlider>
                  <Dashboard />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/feed"
            element={
              <AuthWrapper>
                <Navbar20 page="/feed" collapsed={!drawerOpen} searchable styleToggle cardSlider>
                  <Feed />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/login"
            element={
              <Navbar20 page="/login">
                <AuthWrapper>
                  <Login />
                </AuthWrapper>
              </Navbar20>
            }
          />
          <Route
            path="/settings"
            element={
              <AuthWrapper collapsed={!drawerOpen} redirect={'/login'}>
                <Navbar20 page="/settings">
                  <Settings />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/w/:id"
            element={
              <Navbar20 collapsed toolbar={false} page="/w">
                <AuthWrapper>
                  <Watch />
                </AuthWrapper>
              </Navbar20>
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
