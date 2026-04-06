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
import Games from './views/Games'
import GameVideos from './views/GameVideos'
import Tags from './views/Tags'
import TagVideos from './views/TagVideos'
import darkTheme from './common/darkTheme'
import { ConfigService } from './services'
import { getSetting, setSetting } from './common/utils'
import AuthWrapper from './components/utils/AuthWrapper'
import Navbar20 from './components/nav/Navbar20'
import GlobalDragDropOverlay from './components/utils/GlobalDragDropOverlay'

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
        <GlobalDragDropOverlay>
        <Routes>
          <Route
            path="/"
            element={
              <AuthWrapper redirect={'/feed'}>
                <Navbar20 page="/" collapsed={!drawerOpen} searchable styleToggle cardSlider searchPlaceholder="Search title, game, or #tag...">
                  <Dashboard />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/feed"
            element={
              <AuthWrapper>
                <Navbar20 page="/feed" collapsed={!drawerOpen} searchable styleToggle cardSlider searchPlaceholder="Search title, game, or #tag...">
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
            path="/games"
            element={
              <AuthWrapper>
                <Navbar20 page="/games" collapsed={!drawerOpen} searchable searchPlaceholder="Search games...">
                  <Games />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/games/:gameId"
            element={
              <AuthWrapper>
                <Navbar20 page="/games" collapsed={!drawerOpen} styleToggle cardSlider searchable mainPadding={0}>
                  <GameVideos />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/tags"
            element={
              <AuthWrapper>
                <Navbar20 page="/tags" collapsed={!drawerOpen} searchable searchPlaceholder="Search tags...">
                  <Tags />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/tags/:tagId"
            element={
              <AuthWrapper>
                <Navbar20 page="/tags" collapsed={!drawerOpen} styleToggle cardSlider searchable mainPadding={0}>
                  <TagVideos />
                </Navbar20>
              </AuthWrapper>
            }
          />
          <Route
            path="/w/:id"
            element={
              <Navbar20 collapsed={true} page="/w">
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
        </GlobalDragDropOverlay>
      </ThemeProvider>
    </Router>
  )
}
