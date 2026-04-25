import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { getConfig, saveConfig } from './lib/config-store.mjs';
import { getRules, isWithinBusinessHours, saveRules } from './lib/rules-store.mjs';
import {
  appendMessage,
  getConversationById,
  getMetrics,
  listConversations,
  markHumanRequired
} from './lib/conversations-store.mjs';
import { createWhatsAppAdapter } from './lib/whatsapp/index.mjs';
import { generateAssistantReply } from './lib/assistant.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '../public');
const port = Number(process.env.PORT || 8080);

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

function normalizeConversationMessages(conversation, limit) {
  return conversation.messages.slice(-limit).map((message) => ({
    role: message.from === 'assistant' ? 'assistant' : 'user',
    content: message.text
  }));
}

async function handleInbound(req, res) {
  const body = await parseBody(req);
  const { conversationId, type = 'text', text = '' } = body;

  if (!conversationId) {
    return sendJson(res, 400, { error: 'conversationId é obrigatório' });
  }

  await appendMessage({
    conversationId,
    from: 'user',
    type,
    text,
    metadata: body
  });

  const [config, rules] = await Promise.all([getConfig(), getRules()]);
  const adapter = createWhatsAppAdapter(config);

  if (!rules.automationEnabled) {
    return sendJson(res, 200, { handled: true, reason: 'automation_disabled' });
  }

  if (rules.textOnly && type !== 'text') {
    return sendJson(res, 200, { handled: true, reason: 'non_text_ignored' });
  }

  const normalizedText = text.toLowerCase();
  const triggeredHandoff = rules.handoffKeywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()));
  if (triggeredHandoff) {
    await markHumanRequired(conversationId);
    const handoffText = `${rules.handoffReply}${rules.assistantSignature || ''}`;
    await adapter.sendMessage({ to: conversationId, text: handoffText });
    await appendMessage({ conversationId, from: 'assistant', text: handoffText, metadata: { reason: 'handoff' } });
    return sendJson(res, 200, { handled: true, reason: 'handoff', reply: handoffText });
  }

  if (!isWithinBusinessHours(rules)) {
    const offHoursText = `${rules.offHoursReply}${rules.assistantSignature || ''}`;
    await adapter.sendMessage({ to: conversationId, text: offHoursText });
    await appendMessage({ conversationId, from: 'assistant', text: offHoursText, metadata: { reason: 'off_hours' } });
    return sendJson(res, 200, { handled: true, reason: 'off_hours', reply: offHoursText });
  }

  const conversation = await getConversationById(conversationId);
  const messages = [
    { role: 'system', content: config.systemPrompt },
    ...normalizeConversationMessages(conversation, rules.contextMessageLimit)
  ];

  const aiReply = await generateAssistantReply({ config, messages });
  const finalReply = `${aiReply}${rules.assistantSignature || ''}`;

  await adapter.sendMessage({ to: conversationId, text: finalReply });
  await appendMessage({ conversationId, from: 'assistant', text: finalReply, metadata: { reason: 'ai_reply' } });

  return sendJson(res, 200, { handled: true, reason: 'ai_reply', reply: finalReply });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, service: 'whatsapp-ai-app' });
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      const [config, metrics] = await Promise.all([getConfig(), getMetrics()]);
      const adapter = createWhatsAppAdapter(config);
      const whatsapp = await adapter.status();
      return sendJson(res, 200, { whatsapp, metrics, mode: config.bridgeMode });
    }

    if (req.method === 'GET' && pathname === '/api/rules') {
      return sendJson(res, 200, await getRules());
    }

    if (req.method === 'POST' && pathname === '/api/rules') {
      return sendJson(res, 200, await saveRules(await parseBody(req)));
    }

    if (req.method === 'POST' && pathname === '/api/config') {
      return sendJson(res, 200, await saveConfig(await parseBody(req)));
    }

    if (req.method === 'GET' && pathname === '/api/conversations') {
      return sendJson(res, 200, await listConversations());
    }

    if (req.method === 'GET' && pathname.startsWith('/api/conversations/')) {
      const id = pathname.replace('/api/conversations/', '');
      const conversation = await getConversationById(id);
      if (!conversation) {
        return sendJson(res, 404, { error: 'Conversa não encontrada' });
      }
      return sendJson(res, 200, conversation);
    }

    if (req.method === 'POST' && pathname === '/api/messages/send') {
      const body = await parseBody(req);
      const config = await getConfig();
      const adapter = createWhatsAppAdapter(config);
      await adapter.sendMessage(body);
      await appendMessage({ conversationId: body.to, from: 'assistant', text: body.text, metadata: { manual: true } });
      return sendJson(res, 200, { ok: true });
    }

    if (req.method === 'POST' && pathname === '/api/ai/test') {
      const body = await parseBody(req);
      const config = await getConfig();
      const reply = await generateAssistantReply({
        config,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: body.message || 'Olá' }
        ]
      });
      return sendJson(res, 200, { reply });
    }

    if (req.method === 'POST' && pathname === '/api/whatsapp/connect') {
      const config = await getConfig();
      const adapter = createWhatsAppAdapter(config);
      return sendJson(res, 200, await adapter.connect());
    }

    if (req.method === 'POST' && pathname === '/api/whatsapp/confirm-scan') {
      const config = await getConfig();
      const adapter = createWhatsAppAdapter(config);
      return sendJson(res, 200, await adapter.confirmScan());
    }

    if (req.method === 'POST' && pathname === '/api/inbound/whatsapp') {
      return handleInbound(req, res);
    }

    const filePath = pathname === '/' ? join(publicDir, 'index.html') : join(publicDir, pathname);
    const content = await readFile(filePath);
    const contentType = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'application/javascript'
    }[extname(filePath)];
    res.writeHead(200, { 'Content-Type': contentType || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`whatsapp-ai-app running on port ${port}`);
});
