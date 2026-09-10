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
import Folders from './views/Folders'
import FolderView from './views/FolderView'
import Tags from './views/Tags'
import TagVideos from './views/TagVideos'
import FileManager from './views/FileManager'
import Profile from './views/Profile'
import SetupPassword from './views/SetupPassword'
import darkTheme from './common/darkTheme'
import { ConfigService } from './services'
import { getSetting, setSetting } from './common/utils'
import AuthWrapper from './components/utils/AuthWrapper'
import MainNavbar from './components/nav/MainNavbar'
import GlobalDragDropOverlay from './components/utils/GlobalDragDropOverlay'

const muitheme = createTheme(darkTheme)

export default function App() {
  React.useEffect(() => {
    ConfigService.getConfig()
      .then((res) => res.data)
      .then((config) => {
        setSetting('ui_config', config)
        setSetting('demo_mode', config.demo_mode || false)
        setSetting('is_demo_user', config.is_demo_user || false)
        setSetting('upload_limit_mb', config.upload_limit_mb || 0)
      })
      .catch((err) => console.error(err))
  }, [])

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
                  <MainNavbar
                    page="/"
                    collapsed={!drawerOpen}
                    searchable
                    styleToggle
                    searchPlaceholder="Search title, game, or #tag..."
                  >
                    <Dashboard />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/login"
              element={
                <MainNavbar page="/login" mainPadding={0} toolbar={false}>
                  <AuthWrapper>
                    <Login />
                  </AuthWrapper>
                </MainNavbar>
              }
            />
            <Route
              path="/settings"
              element={
                <AuthWrapper collapsed={!drawerOpen} redirect={'/login'}>
                  <MainNavbar page="/settings">
                    <Settings />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/games"
              element={
                <AuthWrapper>
                  <MainNavbar page="/games" collapsed={!drawerOpen} searchable searchPlaceholder="Search games...">
                    <Games />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/games/:gameId"
              element={
                <AuthWrapper>
                  <MainNavbar page="/games" collapsed={!drawerOpen} styleToggle searchable mainPadding={0}>
                    <GameVideos />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/folders"
              element={
                <AuthWrapper>
                  <MainNavbar page="/folders" collapsed={!drawerOpen} searchable searchPlaceholder="Search folders...">
                    <Folders />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/folder/:folderUuid"
              element={
                <AuthWrapper>
                  <MainNavbar
                    page="/folders"
                    collapsed={!drawerOpen}
                    styleToggle
                    mainPadding={0}
                    searchable
                    searchPlaceholder="Search title..."
                  >
                    <FolderView />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/tags"
              element={
                <AuthWrapper>
                  <MainNavbar page="/tags" collapsed={!drawerOpen} searchable searchPlaceholder="Search tags...">
                    <Tags />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/tags/:tagId"
              element={
                <AuthWrapper>
                  <MainNavbar page="/tags" collapsed={!drawerOpen} styleToggle searchable mainPadding={0}>
                    <TagVideos />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/watch/:id"
              element={
                <AuthWrapper>
                  <MainNavbar collapsed={true} page="/watch">
                    <Watch />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/images"
              element={
                <AuthWrapper>
                  <MainNavbar
                    page="/images"
                    collapsed={!drawerOpen}
                    styleToggle
                    searchable
                    searchPlaceholder="Search title, game, or #tag..."
                  >
                    <ImageFeed />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/image/:id"
              element={
                <AuthWrapper>
                  <MainNavbar collapsed={true} page="/image">
                    <ViewImage />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/files"
              element={
                <AuthWrapper redirect={'/login'}>
                  <MainNavbar page="/files" collapsed={!drawerOpen}>
                    <FileManager />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/profile/:username"
              element={
                <AuthWrapper>
                  <MainNavbar page="/profile" collapsed={!drawerOpen} mainPadding={0}>
                    <Profile />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
            <Route
              path="/setup-password"
              element={
                <MainNavbar page="/setup-password" mainPadding={0} toolbar={false}>
                  <SetupPassword />
                </MainNavbar>
              }
            />
            <Route
              path="*"
              element={
                <AuthWrapper>
                  <MainNavbar page="*">
                    <NotFound />
                  </MainNavbar>
                </AuthWrapper>
              }
            />
          </Routes>
        </GlobalDragDropOverlay>
      </ThemeProvider>
    </Router>
  )
}
