import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/config/api';

export function useDashboardMetrics() {
  return useQuery({
    queryKey: ['metrics', 'dashboard'],
    queryFn: () => apiClient.getDashboardMetrics(),
    refetchInterval: 1000 * 60, // Refetch every minute
  });
}

export function useLeadsByDay(days: number = 30) {
  return useQuery({
    queryKey: ['metrics', 'leads-by-day', days],
    queryFn: () => apiClient.getLeadsByDay(days),
    refetchInterval: 1000 * 60 * 5, // Refetch every 5 minutes
  });
}

export function useTopInterests() {
  return useQuery({
    queryKey: ['metrics', 'top-interests'],
    queryFn: () => apiClient.getTopInterests(),
  });
}

export function useLeads(page: number, limit: number, filters?: any) {
  return useQuery({
    queryKey: ['leads', page, limit, filters],
    queryFn: () => apiClient.getLeads(page, limit, filters),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['lead', id],
    queryFn: () => apiClient.getLead(id),
    enabled: !!id,
  });
}

export function useTenant() {
  return useQuery({
    queryKey: ['tenant'],
    queryFn: () => apiClient.getTenant(),
  });
}

export function useWAHASession(enabled: boolean = true) {
  return useQuery({
    queryKey: ['waha', 'session'],
    queryFn: async () => {
      const { data } = await apiClient.getCurrentWAHASession();
      return data.data;
    },
    enabled,
    refetchInterval: enabled ? 1000 * 3 : false, // Refetch every 3 seconds
  });
}

export function useWAHAQR() {
  return useQuery({
    queryKey: ['waha', 'qr'],
    queryFn: async () => {
      const { data } = await apiClient.getWAHAQR();
      return data.data;
    },
    refetchInterval: 1000 * 5, // Refetch every 5 seconds for QR
    enabled: false, // Only fetch when explicitly called
  });
}

export function useWAHAStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: ['waha', 'status'],
    queryFn: () => apiClient.getWAHAStatus(),
    enabled,
    refetchInterval: enabled ? 1000 * 3 : false,
  });
}

export function useGoogleSheetsConfig(enabled: boolean = true) {
  return useQuery({
    queryKey: ['integrations', 'google-sheets'],
    queryFn: () => apiClient.getGoogleSheetsConfig(),
    enabled,
  });
}
