import axios, { AxiosInstance } from 'axios';

export interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
  description?: string;
}

export interface TelegramBotProfile {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
  can_join_groups?: boolean;
  can_read_all_group_messages?: boolean;
  supports_inline_queries?: boolean;
}

export interface TelegramWebhookInfoResponse {
  ok: boolean;
  result?: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    ip_address?: string;
    last_error_date?: number;
    last_error_message?: string;
    last_synchronization_error_date?: number;
    max_connections?: number;
    allowed_updates?: string[];
  };
  description?: string;
}

export class TelegramService {
  private client: AxiosInstance;

  constructor(private readonly botToken: string) {
    const normalizedToken = botToken.trim();
    this.client = axios.create({
      baseURL: `https://api.telegram.org/bot${normalizedToken}`,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  static fromToken(botToken: string): TelegramService {
    if (!botToken || !botToken.trim()) {
      throw new Error('Telegram bot token is required');
    }

    return new TelegramService(botToken);
  }

  async getMe(): Promise<TelegramBotProfile> {
    const { data } = await this.client.get<{ ok: boolean; result: TelegramBotProfile; description?: string }>('/getMe');

    if (!data.ok || !data.result) {
      throw new Error(data.description || 'Failed to fetch Telegram bot profile');
    }

    return data.result;
  }

  async getWebhookInfo(): Promise<TelegramWebhookInfoResponse['result']> {
    const { data } = await this.client.get<TelegramWebhookInfoResponse>('/getWebhookInfo');

    if (!data.ok) {
      throw new Error(data.description || 'Failed to fetch Telegram webhook info');
    }

    return data.result;
  }

  async setWebhook(webhookUrl: string, secretToken?: string): Promise<void> {
    const payload: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message', 'edited_message'],
      drop_pending_updates: false,
    };

    if (secretToken?.trim()) {
      payload.secret_token = secretToken.trim();
    }

    const { data } = await this.client.post<{ ok: boolean; description?: string }>('/setWebhook', payload);

    if (!data.ok) {
      throw new Error(data.description || 'Failed to register Telegram webhook');
    }
  }

  async deleteWebhook(dropPendingUpdates = false): Promise<void> {
    const { data } = await this.client.post<{ ok: boolean; description?: string }>('/deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });

    if (!data.ok) {
      throw new Error(data.description || 'Failed to delete Telegram webhook');
    }
  }

  async sendMessage(chatId: string | number, text: string): Promise<TelegramSendMessageResponse> {
    const { data } = await this.client.post<TelegramSendMessageResponse>('/sendMessage', {
      chat_id: chatId,
      text,
    });

    if (!data.ok) {
      throw new Error(data.description || 'Failed to send Telegram message');
    }

    return data;
  }
}
