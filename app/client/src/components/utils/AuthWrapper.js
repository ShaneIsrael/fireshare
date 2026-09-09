import React from 'react'
import { Navigate } from 'react-router-dom'
import { AuthService } from '../../services'
import ForcePasswordChange from './ForcePasswordChange'

const RECHECK_INTERVAL = 12 * 60 * 60 * 1000 // 12 hours
let lastCheckTime = 0

const AuthWrapper = ({ children, redirect }) => {
  const [authed, setAuthed] = React.useState(true)
  const [checkingAuth, setCheckingAuth] = React.useState(true)
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [latestRelease, setLatestRelease] = React.useState(null)
  const [loginAllowed, setLoginAllowed] = React.useState(true)
  const [currentUser, setCurrentUser] = React.useState(null)
  const [permissions, setPermissions] = React.useState([])

  const checkLogin = React.useCallback(async () => {
    try {
      const response = (await AuthService.isLoggedIn()).data
      if (typeof response === 'object') {
        setAuthed(response.authenticated)
        setIsAdmin(response.admin || false)
        setLatestRelease(response.latest_release || null)
        setLoginAllowed(response.login_allowed !== false)
        setPermissions(response.permissions || [])
        setCurrentUser(
          response.authenticated
            ? {
                username: response.username,
                display_name: response.display_name,
                name: response.name,
                avatar_url: response.avatar_url,
                ldap: response.ldap,
                must_change_password: response.must_change_password,
              }
            : null,
        )
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

  // An account whose password was chosen by an administrator has to replace it
  // before the rest of the app is reachable. Skipped on /login and
  // /setup-password so a signed-out visitor can never be trapped here.
  const onAuthRoute = ['/login', '/setup-password'].includes(window.location.pathname)
  if (authed && currentUser?.must_change_password && !onAuthRoute) {
    return (
      <ForcePasswordChange
        currentUser={currentUser}
        onChanged={() => {
          lastCheckTime = 0
          checkLogin()
        }}
      />
    )
  }

  const childProps = {
    authenticated: authed,
    isAdmin,
    latestRelease,
    loginAllowed,
    currentUser,
    permissions,
    // Admins bypass every server-side check, so `can` mirrors that rather than
    // relying on the permission list being populated for them.
    can: (permission) => isAdmin || permissions.includes(permission),
  }

  if (!redirect) return React.cloneElement(children, childProps)
  else return authed ? React.cloneElement(children, childProps) : <Navigate to={redirect} />
}

export default AuthWrapper
