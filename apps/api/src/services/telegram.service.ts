import axios, { AxiosInstance } from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_API_BASE_URL = TELEGRAM_BOT_TOKEN
  ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`
  : 'https://api.telegram.org';

export interface TelegramSendMessageResponse {
  ok: boolean;
  result?: {
    message_id: number;
  };
}

export class TelegramService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: TELEGRAM_API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  hasBotToken(): boolean {
    return Boolean(TELEGRAM_BOT_TOKEN);
  }

  async sendMessage(chatId: string | number, text: string): Promise<TelegramSendMessageResponse> {
    if (!this.hasBotToken()) {
      throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    }

    const { data } = await this.client.post<TelegramSendMessageResponse>('/sendMessage', {
      chat_id: chatId,
      text,
    });

    return data;
  }
}

export const telegramService = new TelegramService();
