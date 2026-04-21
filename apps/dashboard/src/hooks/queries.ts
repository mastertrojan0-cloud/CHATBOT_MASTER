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
    staleTime: 3000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
  });
}

export function useWAHAQR(enabled: boolean = false) {
  return useQuery({
    queryKey: ['waha', 'qr'],
    queryFn: async () => {
      const parseQrPayload = (payload: any) => {
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
          return { kind: 'image' as const, value: raw };
        }

        const compact = raw.replace(/\s+/g, '');
        const looksLikeBase64 = /^[A-Za-z0-9+/=]+$/.test(compact) && compact.length > 128;
        if (looksLikeBase64) {
          return { kind: 'image' as const, value: `data:image/png;base64,${compact}` };
        }

        return { kind: 'text' as const, value: raw };
      };

      try {
        // Preferred route: binary image proxy, more stable than strict /qr status checks.
        const blob = await api.getBlob('/sessions/qr-image');
        const url = URL.createObjectURL(blob);
        return { kind: 'image' as const, value: url };
      } catch (imgError: any) {
        try {
          const result = await api.get('/sessions/qr');
          const payload = (result?.data ?? result) as any;
          return parseQrPayload(payload);
        } catch (error: any) {
          if ([404, 409, 500, 503].includes(error?.response?.status)) {
            return null;
          }
          if ([404, 409, 500, 503].includes(imgError?.response?.status)) {
            return null;
          }
          throw error;
        }
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

export function useTelegramHealth(enabled: boolean = true) {
  return useQuery({
    queryKey: ['telegram', 'health'],
    queryFn: async () => {
      const result = await api.get('/health/telegram');
      const payload = (result?.data ?? result) as any;

      return {
        configured: Boolean(payload?.configured),
        dbConnected: Boolean(payload?.dbConnected),
        timestamp: payload?.timestamp || null,
      };
    },
    enabled,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });
}
