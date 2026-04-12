import React from 'react'
import { Route, BrowserRouter as Router, Routes } from 'react-router-dom'
import { createTheme, ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import Login from './views/Login'
import Watch from './views/Watch'
import ViewImage from './views/ViewImage'
import Dashboard from './views/Dashboard'
import NotFound from './views/NotFound'
import Settings from './views/Settings'
import ImageFeed from './views/ImageFeed'
import Games from './views/Games'
import GameVideos from './views/GameVideos'
import Tags from './views/Tags'
import TagVideos from './views/TagVideos'
import FileManager from './views/FileManager'
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
        setSetting('demo_mode', config.demo_mode || false)
        setSetting('upload_limit_mb', config.upload_limit_mb || 0)
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
                <AuthWrapper>
                  <Navbar20
                    page="/"
                    collapsed={!drawerOpen}
                    searchable
                    styleToggle
                    cardSlider
                    searchPlaceholder="Search title, game, or #tag..."
                  >
                    <Dashboard />
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
              path="/watch/:id"
              element={
                <Navbar20 collapsed={true} page="/watch">
                  <AuthWrapper>
                    <Watch />
                  </AuthWrapper>
                </Navbar20>
              }
            />
            <Route
              path="/images"
              element={
                <AuthWrapper>
                  <Navbar20
                    page="/images"
                    collapsed={!drawerOpen}
                    styleToggle
                    cardSlider
                    searchable
                    searchPlaceholder="Search title, game, or #tag..."
                  >
                    <ImageFeed />
                  </Navbar20>
                </AuthWrapper>
              }
            />
            <Route
              path="/image/:id"
              element={
                <Navbar20 collapsed={true} page="/image">
                  <AuthWrapper>
                    <ViewImage />
                  </AuthWrapper>
                </Navbar20>
              }
            />
            <Route
              path="/files"
              element={
                <AuthWrapper redirect={'/login'}>
                  <Navbar20 page="/files" collapsed={!drawerOpen}>
                    <FileManager />
                  </Navbar20>
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
        </GlobalDragDropOverlay>
      </ThemeProvider>
    </Router>
  )
}
