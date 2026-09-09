import Api from './Api'

class UserService {
  // --- Public profiles ---
  getProfile(username) {
    return Api().get(`/api/users/${encodeURIComponent(username)}/profile`)
  }
  getProfileVideos(username, sort = 'updated_at desc') {
    return Api().get(`/api/users/${encodeURIComponent(username)}/videos`, { params: { sort } })
  }
  getProfileImages(username, sort = 'updated_at desc') {
    return Api().get(`/api/users/${encodeURIComponent(username)}/images`, { params: { sort } })
  }
  getProfileGames(username) {
    return Api().get(`/api/users/${encodeURIComponent(username)}/games`)
  }

  // --- Own account ---
  updateProfile(details) {
    return Api().put('/api/account/profile', details)
  }
  uploadAvatar(file, onProgress) {
    const data = new FormData()
    data.append('file', file)
    return Api().post('/api/account/avatar', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      // Avatars are re-encoded server-side, which can outlast the default timeout
      // on a large source image.
      timeout: 60000,
      onUploadProgress: onProgress,
    })
  }
  deleteAvatar() {
    return Api().delete('/api/account/avatar')
  }
  uploadBanner(file, onProgress) {
    const data = new FormData()
    data.append('file', file)
    return Api().post('/api/account/banner', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
      onUploadProgress: onProgress,
    })
  }
  deleteBanner() {
    return Api().delete('/api/account/banner')
  }
  changePassword(currentPassword, newPassword) {
    return Api().post('/api/account/password', {
      current_password: currentPassword,
      new_password: newPassword,
    })
  }

  // --- Invite redemption (unauthenticated) ---
  checkSetupToken(token) {
    return Api().get('/api/account/setup-password', { params: { token } })
  }
  redeemSetupToken(token, password) {
    return Api().post('/api/account/setup-password', { token, password })
  }

  // --- Admin ---
  listUsers() {
    return Api().get('/api/admin/users')
  }
  createUser(details) {
    return Api().post('/api/admin/users', details)
  }
  updateUser(id, details) {
    return Api().put(`/api/admin/users/${id}`, details)
  }
  deleteUser(id) {
    return Api().delete(`/api/admin/users/${id}`)
  }
  setUserPassword(id, password, requirePasswordChange = true) {
    return Api().post(`/api/admin/users/${id}/password`, {
      password,
      require_password_change: requirePasswordChange,
    })
  }
  createInvite(id) {
    return Api().post(`/api/admin/users/${id}/invite`)
  }
  disableUserMfa(id) {
    return Api().post(`/api/admin/users/${id}/mfa/disable`)
  }
  removeUserAvatar(username) {
    return Api().delete(`/api/users/${encodeURIComponent(username)}/avatar`)
  }
  removeUserBanner(username) {
    return Api().delete(`/api/users/${encodeURIComponent(username)}/banner`)
  }
}

const userService = new UserService()

export default userService
