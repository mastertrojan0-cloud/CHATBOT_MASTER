import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['metrics', 'dashboard'],
    queryFn: () => api.get('/metrics'),
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 60,
  });
}

export function useLeadsByDay(days: number = 30) {
  return useQuery({
    queryKey: ['metrics', 'leads-by-day', days],
    queryFn: () => api.get('/metrics/leads-by-day', { days }),
    refetchInterval: 1000 * 60 * 5,
  });
}

export function useTopInterests() {
  return useQuery({
    queryKey: ['metrics', 'top-interests'],
    queryFn: () => api.get('/metrics/top-interests'),
  });
}

export function useLeads(page: number, limit: number, filters?: any) {
  return useQuery({
    queryKey: ['leads', page, limit, filters],
    queryFn: () => api.get('/leads', { page, limit, ...filters }),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => api.get(`/leads/${id}`),
    enabled: !!id,
  });
}

export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => api.get('/tenants/me'),
  });
}

export function useWAHASession() {
  return useQuery({
    queryKey: ['waha', 'session'],
    queryFn: async () => {
      const result = await api.get('/sessions/current');
      return result.data as { status: string; phoneNumber?: string; sessionName?: string };
    },
    retry: 1,
    retryDelay: 1000,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 1000,
    refetchIntervalInBackground: true,
  });
}

export function useWAHAQR(enabled: boolean = false) {
  return useQuery({
    queryKey: ['waha', 'qr'],
    queryFn: async () => {
      try {
        const blob = await api.getBlob('/sessions/qr-image');
        const url = URL.createObjectURL(blob);
        return url;
      } catch (error: any) {
        if ([404, 409, 500, 503].includes(error?.response?.status)) {
          return null;
        }
        throw error;
      }
    },
    refetchInterval: enabled ? 15000 : false,
    enabled,
    retry: 0,
  });
}

export function useWAHAStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: ['waha', 'status'],
    queryFn: () => api.get('/sessions/status'),
    enabled,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: enabled ? 1000 * 3 : false,
  });
}

export function useGoogleSheetsConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: ['integrations', 'google-sheets'],
    queryFn: () => api.get('/tenants/me/google-sheets'),
    enabled,
  });
}
