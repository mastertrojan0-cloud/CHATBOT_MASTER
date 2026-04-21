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
      const payload = (result?.data ?? result) as any;
      return {
        status: payload?.status || '',
        phoneNumber: payload?.phoneNumber || null,
        sessionName: payload?.sessionName || null,
      } as { status: string; phoneNumber?: string; sessionName?: string };
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
        const result = await api.get('/sessions/qr');
        const payload = (result?.data ?? result) as any;
        const raw =
          payload?.value ||
          payload?.qr ||
          payload?.qrCode ||
          payload?.code ||
          null;

        if (!raw || typeof raw !== 'string') {
          return null;
        }

        if (raw.startsWith('data:')) {
          return raw;
        }

        return `data:image/png;base64,${raw}`;
      } catch (error: any) {
        if ([404, 409, 500, 503].includes(error?.response?.status)) {
          return null;
        }
        throw error;
      }
    },
    refetchInterval: enabled ? 3000 : false,
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
