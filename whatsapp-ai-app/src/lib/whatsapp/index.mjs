export function createWhatsAppAdapter(config) {
  if (config.bridgeMode === 'external') {
    return createExternalAdapter(config);
  }
  return createMockAdapter();
}

function createMockAdapter() {
  let status = {
    mode: 'mock',
    status: 'awaiting_scan',
    sessionId: 'main',
    qrText: 'mock-qr-text',
    qrDataUrl: null,
    lastConnectedAt: null,
    lastError: null
  };

  return {
    async status() {
      return status;
    },
    async connect() {
      status = { ...status, status: 'awaiting_scan', qrText: `mock-qr-${Date.now()}` };
      return status;
    },
    async confirmScan() {
      status = { ...status, status: 'connected', lastConnectedAt: new Date().toISOString() };
      return status;
    },
    async sendMessage({ to, text }) {
      return { ok: true, mode: 'mock', to, text, sentAt: new Date().toISOString() };
    }
  };
}

function createExternalAdapter(config) {
  async function request(path, body) {
    const response = await fetch(`${config.bridgeBaseUrl}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Bridge error (${path}): ${response.status} ${text}`);
    }

    return response.json();
  }

  return {
    status: () => request('/status'),
    connect: () => request('/connect', { sessionId: config.sessionId }),
    confirmScan: () => request('/confirm-scan', { sessionId: config.sessionId }),
    sendMessage: ({ to, text }) => request('/messages/send', { sessionId: config.sessionId, to, text })
  };
}
