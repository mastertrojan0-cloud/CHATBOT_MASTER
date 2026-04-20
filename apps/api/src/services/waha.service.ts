import axios, { AxiosInstance } from 'axios';

const RAW_WAHA_URL = process.env.WAHA_URL || process.env.WAHA_BASE_URL || 'http://localhost:3001';
const WAHA_API_KEY = process.env.WAHA_TOKEN || process.env.WAHA_API_KEY || '';
const WAHA_BASE_URL = RAW_WAHA_URL.replace(/\/+$/, '').endsWith('/api')
  ? RAW_WAHA_URL.replace(/\/+$/, '')
  : `${RAW_WAHA_URL.replace(/\/+$/, '')}/api`;

export interface WahaSession {
  id: string;
  name: string;
  status: string;
  phone?: string;
  profile?: string;
}

export interface WahaQrCode {
  code: string;
  expiresAt?: string;
}

export interface WahaWebhook {
  session: string;
  url: string;
  events?: string[];
}

export class WahaService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: WAHA_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': WAHA_API_KEY,
      },
      timeout: 30000,
    });
  }

  async createSession(sessionName: string): Promise<{ session: WahaSession }> {
    const { data } = await this.client.post('/sessions', {
      sessionName,
    });
    return data;
  }

  async deleteSession(sessionName: string): Promise<{ session: WahaSession }> {
    const { data } = await this.client.delete(`/sessions/${sessionName}`);
    return data;
  }

  async startSession(sessionName: string): Promise<{ session: WahaSession }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/start`);
    return data;
  }

  async stopSession(sessionName: string): Promise<{ session: WahaSession }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/stop`);
    return data;
  }

  async getSession(sessionName: string): Promise<{ session: WahaSession | null }> {
    try {
      const { data } = await this.client.get(`/sessions/${sessionName}`);
      return data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { session: null };
      }
      throw error;
    }
  }

  async getQrCode(sessionName: string): Promise<{ qr: { code: string; expiresAt: string } | null }> {
    const { data } = await this.client.get(`/sessions/${sessionName}/qr`);
    return data;
  }

  async setWebhook(sessionName: string, url: string): Promise<{ webhook: WahaWebhook }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/webhook`, {
      url,
      events: ['message', 'session', 'notification'],
    });
    return data;
  }

  async getMe(sessionName: string): Promise<{ me: { id: string; pushName: string; user: string } | null }> {
    const { data } = await this.client.get(`/sessions/${sessionName}/me`);
    return data;
  }

  async sendMessage(sessionName: string, phone: string, message: string): Promise<{ key: { id: string } }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/send`, {
      phone,
      text: message,
    });
    return data;
  }

  async sendLocation(sessionName: string, phone: string, latitude: number, longitude: number, title?: string): Promise<{ key: { id: string } }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/send`, {
      phone,
      location: {
        latitude,
        longitude,
        title: title || 'Location',
      },
    });
    return data;
  }

  async sendFile(sessionName: string, phone: string, fileUrl: string, caption?: string): Promise<{ key: { id: string } }> {
    const { data } = await this.client.post(`/sessions/${sessionName}/send`, {
      phone,
      file: fileUrl,
      text: caption,
    });
    return data;
  }

  async getInstance(): Promise<{ instance: { version: string } }> {
    const { data } = await this.client.get('/instance');
    return data;
  }
}

export const wahaService = new WahaService();