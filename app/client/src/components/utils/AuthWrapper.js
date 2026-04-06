import React from 'react'
import { Navigate } from 'react-router-dom'
import { AuthService } from '../../services'

const RECHECK_INTERVAL = 12 * 60 * 60 * 1000 // 12 hours
let lastCheckTime = 0

const AuthWrapper = ({ children, redirect }) => {
  const [authed, setAuthed] = React.useState(true)
  const [checkingAuth, setCheckingAuth] = React.useState(true)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = React.useState(false)
  const [releaseNotes, setReleaseNotes] = React.useState(null)

  const checkLogin = React.useCallback(async () => {
    try {
      const response = (await AuthService.isLoggedIn()).data
      if (typeof response === 'object') {
        setAuthed(response.authenticated)
        setIsAdmin(response.admin || false)
        setShowReleaseNotes(response.show_release_notes || false)
        setReleaseNotes(response.release_notes || null)
      } else {
        setAuthed(response)
      }
    } catch (err) {
      setAuthed(false)
      console.error(err)
    }
    lastCheckTime = Date.now()
  }, [])

  React.useEffect(() => {
    checkLogin().then(() => setCheckingAuth(false))

    const interval = setInterval(checkLogin, RECHECK_INTERVAL)

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastCheckTime >= RECHECK_INTERVAL) {
        checkLogin()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [checkLogin])

  if (checkingAuth) return <div></div>

  const childProps = {
    authenticated: authed,
    isAdmin,
    showReleaseNotes,
    releaseNotes,
    setShowReleaseNotes,
  }

  if (!redirect) return React.cloneElement(children, childProps)
  else return authed ? React.cloneElement(children, childProps) : <Navigate to={redirect} />
}

export default AuthWrapper
