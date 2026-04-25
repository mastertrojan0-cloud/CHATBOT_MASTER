import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const path = resolve(__dirname, '../data/rules.json');

const DEFAULT_RULES = {
  automationEnabled: true,
  textOnly: true,
  businessHoursEnabled: false,
  businessHours: { start: '09:00', end: '18:00' },
  timezone: 'America/Sao_Paulo',
  offHoursReply: 'Nosso horário de atendimento é comercial. Retornamos em breve.',
  handoffKeywords: ['humano', 'atendente', 'suporte humano'],
  handoffReply: 'Claro! Vou encaminhar para um atendente humano.',
  assistantSignature: '\n\n— Assistente Virtual',
  contextMessageLimit: 20
};

export async function getRules() {
  try {
    const raw = await readFile(path, 'utf-8');
    return { ...DEFAULT_RULES, ...JSON.parse(raw) };
  } catch {
    await saveRules(DEFAULT_RULES);
    return DEFAULT_RULES;
  }
}

export async function saveRules(nextRules) {
  const merged = { ...DEFAULT_RULES, ...nextRules };
  await writeFile(path, JSON.stringify(merged, null, 2));
  return merged;
}

export function isWithinBusinessHours({ businessHoursEnabled, businessHours, timezone }) {
  if (!businessHoursEnabled) {
    return true;
  }

  const now = new Date();
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);

  return time >= businessHours.start && time <= businessHours.end;
}
