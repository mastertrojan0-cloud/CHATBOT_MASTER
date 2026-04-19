import { create } from 'zustand';
import { Tenant, User } from '@/types';
import { apiClient } from '@/config/api';

interface AuthStore {
  user: User | null;
  tenant: Tenant | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setIsLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  tenant: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => set({ tenant }),
  setIsLoading: (isLoading) => set({ isLoading }),
  login: async (email: string, password: string) => {
    try {
      const response = await apiClient.login(email, password);
      if (response.success) {
        const tenantResponse = await apiClient.getTenant();
        if (tenantResponse.success && tenantResponse.data) {
          const tenantData = tenantResponse.data;
          set({
            user: {
              id: tenantData.id,
              email: tenantData.owner?.email || email,
              name: tenantData.owner?.fullName || tenantData.name,
              tenantId: tenantData.id,
            },
            tenant: {
              id: tenantData.id,
              name: tenantData.name,
              businessName: tenantData.name,
              plan: tenantData.plan,
              usage: {
                leadsPerMonth: tenantData.currentMonthUsage?.leads || 0,
                leadsPerMonthLimit: tenantData.monthlyLeadLimit,
                messagesPerMonth: tenantData.currentMonthUsage?.messages || 0,
              },
              waConnected: tenantData.wahaConnected,
              waStatus: 'disconnected',
            },
          });
          return { success: true };
        }
      }
      return { success: false, error: response.error?.message || 'Login failed' };
    } catch (error) {
      return { success: false, error: 'Login failed' };
    }
  },
  logout: async () => {
    await apiClient.logout();
    set({ user: null, tenant: null });
  },
}));
