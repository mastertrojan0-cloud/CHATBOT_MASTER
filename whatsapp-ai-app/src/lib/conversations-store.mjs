import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '../data/conversations.json');

async function readAll() {
  try {
    const raw = await readFile(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    await writeAll([]);
    return [];
  }
}

async function writeAll(conversations) {
  await writeFile(path, JSON.stringify(conversations, null, 2));
}

export async function listConversations() {
  return readAll();
}

export async function getConversationById(id) {
  const conversations = await readAll();
  return conversations.find((item) => item.id === id) || null;
}

export async function appendMessage({ conversationId, from, type = 'text', text, metadata = {} }) {
  const conversations = await readAll();
  let conversation = conversations.find((item) => item.id === conversationId);

  if (!conversation) {
    conversation = {
      id: conversationId,
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    conversations.push(conversation);
  }

  conversation.messages.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    from,
    type,
    text,
    metadata,
    timestamp: new Date().toISOString()
  });
  conversation.updatedAt = new Date().toISOString();

  await writeAll(conversations);
  return conversation;
}

export async function markHumanRequired(conversationId) {
  const conversations = await readAll();
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    return null;
  }
  conversation.status = 'human_required';
  conversation.updatedAt = new Date().toISOString();
  await writeAll(conversations);
  return conversation;
}

export async function getMetrics() {
  const conversations = await readAll();
  const total = conversations.length;
  const open = conversations.filter((item) => item.status === 'open').length;
  const humanRequired = conversations.filter((item) => item.status === 'human_required').length;

  return { totalConversations: total, openConversations: open, humanRequiredConversations: humanRequired };
}
