// User and Tenant types
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro';
  isActive: boolean;
  businessSegment: string;
  wahaSessionName: string;
  wahaConnected: boolean;
  monthlyMessageLimit: number;
  monthlyLeadLimit: number;
  currentMonthUsage: Record<string, number> | null;
  notifyEmail: string | null;
  notifyPhone: string | null;
  stripeCustomerId: string | null;
  planExpiresAt: Date | null;
  owner: { email: string; fullName: string } | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  tenantId: string;
}

// Lead types
export interface Lead {
  id: string;
  tenantId: string;
  contactId: string;
  name: string;
  phone: string;
  email: string | null;
  status: 'NEW' | 'QUALIFIED' | 'NURTURING' | 'WON' | 'LOST' | 'DISQUALIFIED';
  score: number;
  capturedData: Record<string, unknown> | null;
  isHot: boolean;
  isQualified: boolean;
  firstCapturedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadFilters {
  status?: Lead['status'];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  interestIn?: string[];
  scoreMin?: number;
  scoreMax?: number;
}

export type LeadTableColumn =
  | 'name'
  | 'phone'
  | 'status'
  | 'score'
  | 'interests'
  | 'createdAt'
  | 'messages'
  | 'actions';

// Dashboard types
export interface DashboardMetrics {
  leadsToday: number;
  leadsMonth: number;
  leadsTotal: number;
  conversionRate: number;
  msgCountMonth: number;
  msgLimit: number | null;
  contactCount: number;
  contactLimit: number | null;
  topInterests: Array<{ interest: string; count: number }>;
  leadsByDay: Array<{ date: string; count: number }>;
}

export interface LeadsByDay {
  date: string;
  count: number;
}

export interface TopInterest {
  interest: string;
  count: number;
}

export interface RecentLead {
  id: string;
  name: string;
  phone: string;
  status: Lead['status'];
  score: number;
  createdAt: Date;
}

// WAHA Connection types
export interface WAHAStatus {
  state: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'SCAN_QR_CODE';
  qr?: string;
  message?: string;
}

// Notification types
export interface NotificationSettings {
  waNotifications: boolean;
  emailNotifications: boolean;
  newLeadAlert: boolean;
  messageAlert: boolean;
}

// Settings types
export interface BusinessSettings {
  businessName: string;
  industry: string;
  phone: string;
  email: string;
  website?: string;
}

export interface GoogleSheetsConfig {
  connected: boolean;
  spreadsheetId?: string;
  sheetName?: string;
}

// Pagination
export interface PaginationParams {
  page: number;
  limit: number;
  total?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}
