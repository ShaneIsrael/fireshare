import Api from './Api'

// Deduplicate concurrent isLoggedIn calls — all callers that fire while a
// request is in-flight share the same promise instead of making extra requests.
let _loggedInPromise = null

class AuthService {
  login(username, password) {
    return Api().post('/api/login', {
      username,
      password,
    })
  }
  logout() {
    _loggedInPromise = null
    return Api().post('/api/logout')
  }
  isLoggedIn() {
    if (_loggedInPromise) return _loggedInPromise
    _loggedInPromise = Api().get('/api/loggedin').finally(() => {
      _loggedInPromise = null
    })
    return _loggedInPromise
  }
}

const authService = new AuthService()

export default authService
