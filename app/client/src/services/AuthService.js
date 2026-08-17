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
  loginMfa(code) {
    return Api().post('/api/login/mfa', { code })
  }
  getMfaStatus() {
    return Api().get('/api/mfa/status')
  }
  setupMfa() {
    return Api().post('/api/mfa/setup')
  }
  confirmMfa(code) {
    return Api().post('/api/mfa/confirm', { code })
  }
  disableMfa(code) {
    return Api().post('/api/mfa/disable', { code })
  }
}

const authService = new AuthService()

export default authService
