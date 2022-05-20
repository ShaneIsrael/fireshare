import Api from './Api'

class AuthService {
  login(username, password) {
    return Api().post('/api/login', {
      username,
      password,
    })
  }
  logout() {
    return Api().post('/api/logout')
  }
  isLoggedIn() {
    return Api().get('/api/loggedin')
  }
}

export default new AuthService()
