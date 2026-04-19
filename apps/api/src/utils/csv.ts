import { createObjectCsvStringifier } from 'csv-writer';
import { Lead } from '../types';

/**
 * Converter leads para CSV string
 */
export function stringToCSV(leads: Lead[]): string {
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'id', title: 'ID' },
      { id: 'name', title: 'Nome' },
      { id: 'phone', title: 'Telefone' },
      { id: 'email', title: 'Email' },
      { id: 'status', title: 'Status' },
      { id: 'score', title: 'Score' },
      { id: 'interests', title: 'Interesses' },
      { id: 'messages', title: 'Mensagens' },
      { id: 'createdAt', title: 'Data de Criação' },
      { id: 'updatedAt', title: 'Última Atualização' },
    ],
  });

  const records = leads.map((lead) => ({
    id: lead.id,
    name: lead.name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    status: lead.status,
    score: lead.score,
    source: lead.source,
    isQualified: lead.isQualified,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  }));

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
}

/**
 * Validar dados do lead
 */
export function validateLead(lead: any): boolean {
  if (!lead.name || typeof lead.name !== 'string') return false;
  if (!lead.phone || typeof lead.phone !== 'string') return false;
  if (lead.email && typeof lead.email !== 'string') return false;
  return true;
}

/**
 * Formatar telefone
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 11) return phone;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

/**
 * Calcular score baseado em interações
 */
export function calculateScore(lead: {
  messages?: number;
  lastInteractionAt?: Date;
  status?: string;
}): number {
  let score = 0;

  // Base score por status
  const statusScores: Record<string, number> = {
    new: 10,
    contacted: 30,
    interested: 60,
    qualified: 90,
    lost: 0,
  };

  score += statusScores[lead.status || 'new'] || 0;

  // Ajuste por mensagens
  if (lead.messages) {
    score += Math.min(lead.messages * 5, 30);
  }

  // Ajuste por recência
  if (lead.lastInteractionAt) {
    const daysAgo =
      (Date.now() - new Date(lead.lastInteractionAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysAgo < 1) score += 10;
    else if (daysAgo < 7) score += 5;
  }

  return Math.min(100, score);
}
