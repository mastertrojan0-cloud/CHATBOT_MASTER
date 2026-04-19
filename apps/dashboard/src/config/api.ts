import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3333/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Auth
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    if (data.success && data.data.accessToken) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  }

  async register(email: string, password: string, fullName?: string) {
    const { data } = await this.client.post('/auth/register', { email, password, fullName });
    return data;
  }

  async logout() {
    try {
      await this.client.post('/auth/logout');
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
    }
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) throw new Error('No refresh token');
    const { data } = await this.client.post('/auth/refresh', { refreshToken });
    if (data.success && data.data.accessToken) {
      localStorage.setItem('authToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
    }
    return data;
  }

  // Metrics
  async getDashboardMetrics() {
    const { data } = await this.client.get('/metrics');
    return data;
  }

  async getLeadsByDay(days: number = 30) {
    const { data } = await this.client.get(`/metrics/leads-by-day?days=${days}`);
    return data;
  }

  async getTopInterests() {
    const { data } = await this.client.get('/metrics/top-interests');
    return data;
  }

  // Leads
  async getLeads(page: number = 1, limit: number = 10, filters?: any) {
    const { data } = await this.client.get('/leads', {
      params: { page, limit, ...filters },
    });
    return data;
  }

  async getLead(id: string) {
    const { data } = await this.client.get(`/leads/${id}`);
    return data;
  }

  async createLead(lead: any) {
    const { data } = await this.client.post('/leads', lead);
    return data;
  }

  async updateLead(id: string, lead: any) {
    const { data } = await this.client.put(`/leads/${id}`, lead);
    return data;
  }

  async deleteLead(id: string) {
    await this.client.delete(`/leads/${id}`);
  }

  async exportLeadsCSV(filters?: any) {
    const { data } = await this.client.get('/leads/export/csv', {
      params: filters,
      responseType: 'blob',
    });
    return data;
  }

  // WAHA
  async getWAHAStatus() {
    const { data } = await this.client.get('/sessions/status');
    return data;
  }

  async getWAHAQR() {
    const { data } = await this.client.get('/sessions/qr');
    return data;
  }

  async connectWAHA() {
    const { data } = await this.client.post('/sessions/connect');
    return data;
  }

  // Settings
  async getTenant() {
    const { data } = await this.client.get('/tenants/me');
    return data;
  }

  async updateBusinessSettings(settings: any) {
    const { data } = await this.client.put('/tenants/me', settings);
    return data;
  }

  async updateNotificationSettings(settings: any) {
    const { data } = await this.client.put('/tenants/me/notifications', settings);
    return data;
  }

  async connectGoogleSheets(spreadsheetId: string, sheetName: string) {
    const { data } = await this.client.post('/tenants/me/google-sheets', {
      spreadsheetId,
      sheetName,
    });
    return data;
  }

  async getGoogleSheetsConfig() {
    const { data } = await this.client.get('/tenants/me/google-sheets');
    return data;
  }

  async startGoogleSheetsOAuth() {
    const { data } = await this.client.post('/tenants/me/google-sheets/oauth');
    return data;
  }
}

export const apiClient = new ApiClient();
