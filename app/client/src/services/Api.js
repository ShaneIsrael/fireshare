import axios from 'axios'
import { getUrl } from '../common/utils'

const URL = getUrl()

const cancelToken = axios.CancelToken.source()

const instance = axios.create({
  baseURL: URL,
  timeout: 10000,
})

instance.interceptors.request.use(async (config) => {
  config.cancelToken = cancelToken.token
  return config
})

instance.interceptors.response.use(
  (response) => {
    return response
  },
  (error) => {
    if (!axios.isCancel(error)) {
      if (error.response?.status === 401) {
        // window.location.href = '/login'
      }
      return Promise.reject(error)
    }
    return null
  },
)
const Api = () => {
  instance.defaults.withCredentials = true
  return instance
}

export default Api
