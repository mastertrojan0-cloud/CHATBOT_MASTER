import { Buffer } from 'node:buffer';
import { state } from './state.mjs';

function toFakeQrDataUrl(text) {
  const payload = Buffer.from(text, 'utf-8').toString('base64');
  return `data:image/png;base64,${payload}`;
}

export async function connect({ sessionId = 'main' } = {}) {
  try {
    state.sessionId = sessionId;
    state.status = 'awaiting_scan';
    state.qrText = `wa-web-session:${sessionId}:${Date.now()}`;
    state.qrDataUrl = toFakeQrDataUrl(state.qrText);
    state.lastError = null;
    return state;
  } catch (error) {
    state.lastError = error.message;
    throw error;
  }
}

export async function confirmScan({ sessionId = 'main' } = {}) {
  state.sessionId = sessionId;
  state.status = 'connected';
  state.lastConnectedAt = new Date().toISOString();
  state.qrText = null;
  state.qrDataUrl = null;
  return state;
}

export async function sendMessage({ sessionId = 'main', to, text }) {
  if (state.status !== 'connected') {
    throw new Error('Sessão não está conectada');
  }

  return {
    ok: true,
    sessionId,
    to,
    text,
    sentAt: new Date().toISOString(),
    provider: 'whatsapp-web.js (stub)'
  };
}
