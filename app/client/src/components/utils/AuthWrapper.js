import React from 'react'
import { Navigate } from 'react-router-dom'
import { AuthService } from '../../services'

const AuthWrapper = ({ children, redirect }) => {
  const [authed, setAuthed] = React.useState(true)
  const [checkingAuth, setCheckingAuth] = React.useState(true)
  React.useEffect(() => {
    async function isLoggedIn() {
      try {
        const authed = (await AuthService.isLoggedIn()).data
        setAuthed(authed)
      } catch (err) {
        setAuthed(false)
        console.error(err)
      }
      setCheckingAuth(false)
    }
    isLoggedIn()
  })

  if (checkingAuth) return <div></div>

  if (!redirect) return React.cloneElement(children, { authenticated: authed })
  else return authed ? React.cloneElement(children, { authenticated: authed }) : <Navigate to={redirect} />
}

export default AuthWrapper
