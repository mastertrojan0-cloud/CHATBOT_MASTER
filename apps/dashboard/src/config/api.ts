import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const PROD_API_URL = 'https://flowdesk-api-production-e03a.up.railway.app/api'
const TENANT_STORAGE_KEY = 'flowdesk_tenant_id'

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL
  if (configured && configured.trim()) {
    return configured
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase()
    if (
      host === 'chatbot-master-dashboard.vercel.app' ||
      host.endsWith('.vercel.app')
    ) {
      return PROD_API_URL
    }
  }

  return '/api'
}

const BASE_URL = resolveBaseUrl()
let isHandling401 = false

function getToken(): string {
  return useAuthStore.getState().token || ''
}

function getTenantId(): string {
  const state = useAuthStore.getState()
  return (
    state.user?.tenantId ||
    state.tenant?.id ||
    sessionStorage.getItem(TENANT_STORAGE_KEY) ||
    ''
  )
}

function authHeaders(): Record<string, string> {
  const token = getToken()
  const tenantId = getTenantId()
  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  if (tenantId) {
    headers['X-Tenant-Id'] = tenantId
  }

  return headers
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
