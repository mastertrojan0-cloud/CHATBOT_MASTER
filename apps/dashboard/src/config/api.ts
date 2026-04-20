import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api'

function getToken(): string {
  return sessionStorage.getItem('flowdesk_access') || ''
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

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
