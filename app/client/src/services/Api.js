import axios from 'axios'
import { getUrl } from '../common/utils'

const URL = getUrl()

const controller = new AbortController()

const instance = axios.create({
  baseURL: URL,
  timeout: 25000,
})

instance.interceptors.request.use((config) => {
  config.signal = controller.signal
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
