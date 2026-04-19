// Format phone number
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 11) return phone;
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

// Format date
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

// Format datetime
export function formatDateTime(date: string | Date): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

// Format number with commas
export function formatNumber(num: number): string {
  return num.toLocaleString('pt-BR');
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Truncate text
export function truncateText(text: string, length: number): string {
  if (text.length <= length) return text;
  return text.slice(0, length) + '...';
}

// Get initials from name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Get status color
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    connected: 'text-green-400',
    disconnected: 'text-red-400',
    connecting: 'text-yellow-400',
    'scan_qr_code': 'text-blue-400',
    new: 'text-blue-400',
    contacted: 'text-yellow-400',
    interested: 'text-brand-400',
    qualified: 'text-green-400',
    lost: 'text-red-400',
  };
  return colors[status] || 'text-dark-400';
}

// Get status badge variant
export function getStatusVariant(status: string): 'brand' | 'success' | 'warning' | 'error' | 'neutral' {
  const variants: Record<string, 'brand' | 'success' | 'warning' | 'error' | 'neutral'> = {
    connected: 'success',
    disconnected: 'error',
    connecting: 'warning',
    'scan_qr_code': 'brand',
    new: 'brand',
    contacted: 'warning',
    interested: 'brand',
    qualified: 'success',
    lost: 'error',
  };
  return variants[status] || 'neutral';
}

// Parse query params
export function parseQueryParams(query: string): Record<string, string> {
  const params = new URLSearchParams(query);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

// Build query string
export function buildQueryString(params: Record<string, any>): string {
  const filtered = Object.entries(params).filter(([, v]) => v !== null && v !== undefined);
  return filtered.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
}
