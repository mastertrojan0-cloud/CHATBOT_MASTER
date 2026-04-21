import axios, { AxiosInstance } from 'axios';

const RAW_WAHA_URL = process.env.WAHA_URL || process.env.WAHA_BASE_URL || 'http://localhost:3000';
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

  getBaseUrl(): string {
    return WAHA_BASE_URL;
  }

  hasApiKey(): boolean {
    return Boolean(WAHA_API_KEY);
  }

  private toChatId(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    return digits.endsWith('@c.us') ? digits : `${digits}@c.us`;
  }

  private getErrorPayload(error: unknown): unknown {
    if (axios.isAxiosError(error)) {
      return {
        message: error.message,
        code: error.code || null,
        status: error.response?.status || null,
        data: error.response?.data || null,
        address: (error as any).address || null,
        port: (error as any).port || null,
      };
    }
    if (error instanceof Error) {
      return error.message;
    }
    return error;
  }

  async createSession(sessionName: string, webhookUrl?: string): Promise<WahaSession> {
    const body: Record<string, unknown> = { name: sessionName };
    if (webhookUrl) {
      body.config = {
        webhooks: [{ url: webhookUrl, events: ['message', 'session.status'] }],
      };
    }
    const { data } = await this.client.post('/sessions', body);
    return data;
  }

  async deleteSession(sessionName: string): Promise<void> {
    await this.client.delete(`/sessions/${sessionName}`);
  }

  async startSession(sessionName: string): Promise<void> {
    // Idempotent: safe to call even if already starting
    await this.client.post(`/sessions/${sessionName}/start`);
  }

  async stopSession(sessionName: string): Promise<void> {
    // Idempotent: safe to call even if already stopped
    await this.client.post(`/sessions/${sessionName}/stop`);
  }

  async restartSession(sessionName: string): Promise<void> {
    // Stops (if running) then starts — correct approach for FAILED status
    await this.client.post(`/sessions/${sessionName}/restart`);
  }

  async logoutSession(sessionName: string): Promise<void> {
    // Removes auth data, keeps config — use when restart doesn't fix FAILED
    await this.client.post(`/sessions/${sessionName}/logout`);
  }

  /**
   * Update session config using PUT — only call when session is STOPPED.
   * WARNING: If session is NOT stopped, WAHA will stop and restart it.
   */
  async updateSessionConfig(sessionName: string, webhookUrl: string): Promise<void> {
    await this.client.put(`/sessions/${sessionName}`, {
      name: sessionName,
      config: {
        webhooks: [{ url: webhookUrl, events: ['message', 'session.status'] }],
      },
    });
  }

  async getSession(sessionName: string): Promise<{ session: WahaSession | null }> {
    try {
      const { data } = await this.client.get(`/sessions/${sessionName}`);
      return { session: data };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { session: null };
      }
      throw error;
    }
  }

  /** Returns raw PNG buffer for QR code (no base64 conversion needed) */
  async getQrCodeImage(sessionName: string): Promise<Buffer | null> {
    try {
      const { data } = await this.client.get(`/${sessionName}/auth/qr`, {
        params: { format: 'image' },
        headers: { Accept: 'image/png' },
        responseType: 'arraybuffer',
      });
      return Buffer.from(data);
    } catch (error: any) {
      if ([400, 404, 422].includes(error.response?.status)) {
        return null;
      }
      throw error;
    }
  }

  async getQrCode(sessionName: string): Promise<{ qr: { code: string; expiresAt: string } | null }> {
    try {
      // ?format=image + Accept: application/json → { mimetype: "image/png", data: "base64string" }
      // Without ?format=image WAHA returns binary PNG regardless of Accept header
      const { data } = await this.client.get(`/${sessionName}/auth/qr`, {
        params: { format: 'image' },
        headers: { Accept: 'application/json' },
      });
      if (data?.data) {
        const mime = data.mimetype || 'image/png';
        const dataUrl = data.data.startsWith('data:') ? data.data : `data:${mime};base64,${data.data}`;
        return { qr: { code: dataUrl, expiresAt: '' } };
      }
      return { qr: null };
    } catch (error: any) {
      if ([400, 404, 422].includes(error.response?.status)) {
        return { qr: null };
      }
      throw error;
    }
  }

  /** @deprecated */
  async setWebhook(sessionName: string, url: string): Promise<void> {
    console.warn('setWebhook is deprecated — use updateSessionConfig when session is STOPPED');
  }

  async getMe(sessionName: string): Promise<{ me: { id: string; pushName: string; user: string } | null }> {
    const { data } = await this.client.get(`/sessions/${sessionName}/me`);
    return data;
  }

  async sendMessage(sessionName: string, phone: string, message: string): Promise<{ key: { id: string } }> {
    const { data } = await this.client.post('/sendText', {
      session: sessionName,
      chatId: this.toChatId(phone),
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

  async getDiagnostics(sessionName: string): Promise<Record<string, unknown>> {
    const diagnostics: Record<string, unknown> = {
      baseUrl: this.getBaseUrl(),
      hasApiKey: this.hasApiKey(),
      sessionName,
    };

    try {
      diagnostics.instance = await this.getInstance();
    } catch (error) {
      diagnostics.instanceError = this.getErrorPayload(error);
    }

    try {
      diagnostics.session = await this.getSession(sessionName);
    } catch (error) {
      diagnostics.sessionError = this.getErrorPayload(error);
    }

    try {
      diagnostics.me = await this.getMe(sessionName);
    } catch (error) {
      diagnostics.meError = this.getErrorPayload(error);
    }

    try {
      diagnostics.qr = await this.getQrCode(sessionName);
    } catch (error) {
      diagnostics.qrError = this.getErrorPayload(error);
    }

    return diagnostics;
  }
}

export const wahaService = new WahaService();
