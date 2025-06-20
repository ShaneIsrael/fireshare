import Api from './Api'

const service = {
  getVideos(sort) {
    return Api().get('/api/videos', {
      params: {
        sort,
      },
    })
  },
  getPublicVideos(sort) {
    return Api().get('/api/videos/public', {
      params: {
        sort,
      },
    })
  },
  getDetails(id) {
    return Api().get(`/api/video/details/${id}`)
  },
  getRandomVideo() {
    return Api().get('/api/video/random')
  },
  getRandomPublicVideo() {
    return Api().get('/api/video/public/random')
  },
  getViews(id) {
    return Api().get(`/api/video/${id}/views`)
  },
  updateTitle(id, title) {
    return Api().put(`/api/video/details/${id}`, {
      title,
    })
  },
  updatePrivacy(id, value) {
    return Api().put(`/api/video/details/${id}`, {
      private: value,
    })
  },
  updateDetails(id, details) {
    return Api().put(`/api/video/details/${id}`, {
      ...details,
    })
  },
  addView(id) {
    return Api().post(`/api/video/view`, {
      video_id: id,
    })
  },
  delete(id) {
    return Api().delete(`/api/video/delete/${id}`)
  },
  upload(formData, uploadProgress) {
    return Api().post('/api/upload', formData, {
      timeout: 999999999,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.loaded / progressEvent.total
        uploadProgress(progress, {
          loaded: progressEvent.loaded / Math.pow(10, 6),
          total: progressEvent.total / Math.pow(10, 6),
        })
      },
    })
  },
  publicUpload(formData, uploadProgress) {
    return Api().post('/api/upload/public', formData, {
      timeout: 999999999,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.loaded / progressEvent.total
        console.log(progressEvent)
        uploadProgress(progress, {
          loaded: progressEvent.loaded / Math.pow(10, 6),
          total: progressEvent.total / Math.pow(10, 6),
        })
      },
    })
  },
  uploadChunked(formData, uploadProgress, totalSize, alreadyUploaded) {
    return Api().post('/api/uploadChunked', formData, {
      timeout: 999999999,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = (progressEvent.loaded + alreadyUploaded) / totalSize
        uploadProgress(progress, {
          loaded: (progressEvent.loaded + alreadyUploaded) / Math.pow(10, 6),
          total: totalSize / Math.pow(10, 6),
        })
      },
    })
  },
  publicUploadChunked(formData, uploadProgress) {
    return Api().post('/api/upload/publicChunked', formData, {
      timeout: 999999999,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const progress = progressEvent.loaded / progressEvent.total
        console.log(progressEvent)
        uploadProgress(progress, {
          loaded: progressEvent.loaded / Math.pow(10, 6),
          total: progressEvent.total / Math.pow(10, 6),
        })
      },
    })
  },
  scan() {
    return Api().get('/api/manual/scan')
  },
}

export default service
