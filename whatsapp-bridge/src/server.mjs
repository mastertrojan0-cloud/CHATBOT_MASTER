import { createServer } from 'node:http';
import { connect, confirmScan, sendMessage } from './client.mjs';
import { state } from './state.mjs';

const port = Number(process.env.PORT || 8081);

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function parseBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf-8'));
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return sendJson(res, 200, { ok: true, service: 'whatsapp-bridge' });
    }

    if (req.method === 'GET' && url.pathname === '/status') {
      return sendJson(res, 200, state);
    }

    if (req.method === 'POST' && url.pathname === '/connect') {
      return sendJson(res, 200, await connect(await parseBody(req)));
    }

    if (req.method === 'POST' && url.pathname === '/confirm-scan') {
      return sendJson(res, 200, await confirmScan(await parseBody(req)));
    }

    if (req.method === 'POST' && url.pathname === '/messages/send') {
      return sendJson(res, 200, await sendMessage(await parseBody(req)));
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    state.lastError = error.message;
    sendJson(res, 500, { error: error.message });
  }
}).listen(port, () => {
  console.log(`whatsapp-bridge running on port ${port}`);
});
