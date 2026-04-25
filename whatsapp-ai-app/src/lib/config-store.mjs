import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '../data/config.json');

const DEFAULT_CONFIG = {
  openaiModel: 'gpt-4.1-mini',
  systemPrompt: 'Você é um assistente prestativo para atendimento via WhatsApp.',
  openaiApiKey: '',
  bridgeMode: 'mock',
  bridgeBaseUrl: 'http://whatsapp-bridge:8081',
  sessionId: 'main'
};

export async function getConfig() {
  try {
    const raw = await readFile(path, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    await saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(nextConfig) {
  const merged = { ...DEFAULT_CONFIG, ...nextConfig };
  await writeFile(path, JSON.stringify(merged, null, 2));
  return merged;
}
