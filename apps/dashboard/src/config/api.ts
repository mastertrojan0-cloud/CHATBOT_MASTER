import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const BASE_URL = import.meta.env.VITE_API_URL || '/api'
let isHandling401 = false

function getToken(): string {
  return useAuthStore.getState().token || ''
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && !isHandling401) {
      const currentToken = useAuthStore.getState().token

      if (currentToken) {
        isHandling401 = true
        try {
          await useAuthStore.getState().logout()
        } finally {
          window.location.replace('/login')
        }
      }
    }

    return Promise.reject(error)
  }
)

export const api = {
  get: (url: string, params?: Record<string, unknown>) =>
    axios.get(`${BASE_URL}${url}`, { headers: authHeaders(), params }).then(r => r.data),

  getBlob: (url: string, params?: Record<string, unknown>) =>
    axios.get(`${BASE_URL}${url}`, { headers: authHeaders(), params, responseType: 'blob' }).then(r => r.data),

  post: (url: string, data?: unknown) =>
    axios.post(`${BASE_URL}${url}`, data, { headers: authHeaders() }).then(r => r.data),

  put: (url: string, data?: unknown) =>
    axios.put(`${BASE_URL}${url}`, data, { headers: authHeaders() }).then(r => r.data),

  patch: (url: string, data?: unknown) =>
    axios.patch(`${BASE_URL}${url}`, data, { headers: authHeaders() }).then(r => r.data),

  delete: (url: string) =>
    axios.delete(`${BASE_URL}${url}`, { headers: authHeaders() }).then(r => r.data),
}

export default api
