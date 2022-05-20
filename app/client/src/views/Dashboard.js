import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AuthService } from '../services'

const Dashboard = () => {
  const [authenticated, setAuthenticated] = React.useState(false)
  const navigate = useNavigate()

  React.useEffect(() => {
    async function isLoggedIn() {
      try {
        if (!(await AuthService.isLoggedIn()).data) {
          navigate('/login')
        } else {
          setAuthenticated(true)
        }
      } catch (err) {
        console.log(err)
      }
    }
    isLoggedIn()
  }, [navigate])

  if (!authenticated) return null

  return <div>The Dashboard</div>
}

export default Dashboard
