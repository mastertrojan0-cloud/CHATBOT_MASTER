import { Request } from 'express';

// User autenticado do Supabase
export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  aud?: string;
}

// Requisição estendida com user e tenant
export interface AuthRequest extends Request {
  user?: AuthUser;
  tenantId?: string;
}

// Resposta padrão da API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    path: string;
  };
}

// Paginação
export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationParams;
}

// Lead
export interface Lead {
  id: string;
  tenantId: string;
  contactId: string;
  conversationId?: string;
  flowId?: string;
  name?: string;
  email?: string;
  phone?: string;
  source: 'WHATSAPP' | 'IMPORT' | 'API' | 'MANUAL' | 'GOOGLE_SHEETS';
  status: 'NEW' | 'QUALIFIED' | 'NURTURING' | 'WON' | 'LOST' | 'DISQUALIFIED';
  score: number;
  capturedData?: any;
  qualificationNotes?: string;
  automationEnabled: boolean;
  automationPaused: boolean;
  automationQualified: boolean;
  automationEscalatedToHuman: boolean;
  isHot: boolean;
  isQualified: boolean;
  firstCapturedAt: Date;
  lastQualifiedAt?: Date;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateLeadDTO {
  name: string;
  phone: string;
  email?: string;
  interests?: string[];
}

export interface UpdateLeadDTO {
  status?: Lead['status'];
  score?: number;
  interests?: string[];
}

// Leads Stats
export interface LeadsStats {
  leadsToday: number;
  leadsThisMonth: number;
  messagesThisMonth: number;
  contactsToday: number;
  conversionRate: number;
  avgResponseTime: number;
  recentLeads: Lead[];
}

export interface LeadsByDay {
  date: string;
  leads: number;
}

export interface TopInterest {
  name: string;
  count: number;
  percentage: number;
}

// Session (WhatsApp)
export interface WhatsAppSession {
  id: string;
  tenantId: string;
  state: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR_CODE';
  qr?: string;
  phoneNumber?: string;
  connectedAt?: Date;
  disconnectedAt?: Date;
  error?: string;
}

// Tenant
export interface Tenant {
  id: string;
  userId: string;
  name: string;
  businessName: string;
  plan: 'free' | 'pro';
  leadsPerMonthLimit: number;
  waConnected: boolean;
  notificationsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateTenantDTO {
  businessName?: string;
  industry?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export interface NotificationSettings {
  waNotifications: boolean;
  emailNotifications: boolean;
  newLeadAlert: boolean;
  messageAlert: boolean;
}

// Google Sheets Config
export interface GoogleSheetsConfig {
  id: string;
  tenantId: string;
  spreadsheetId: string;
  sheetName: string;
  syncEnabled: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Stripe
export interface StripeCheckoutSession {
  sessionId: string;
  url: string;
  expiresAt: Date;
}

// Query Filters
export interface LeadFilters {
  search?: string;
  status?: Lead['status'];
  interestIn?: string[];
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: Date;
  dateTo?: Date;
}
