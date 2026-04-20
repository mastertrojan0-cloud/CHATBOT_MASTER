import { create } from 'zustand';
import { Tenant, User } from '@/types';
import api from '@/config/api';
import { queryClient } from '@/config/queryClient';

interface AuthStore {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setToken: (token: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  tenant: null,
  token: sessionStorage.getItem('flowdesk_access'),
  isLoading: true,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => set({ tenant }),
  setToken: (token) => {
    if (token) {
      sessionStorage.setItem('flowdesk_access', token);
    } else {
      sessionStorage.removeItem('flowdesk_access');
    }
    set({ token });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (response.success) {
        // Set token from response
        if (response.data?.accessToken) {
          set({ token: response.data.accessToken });
          sessionStorage.setItem('flowdesk_access', response.data.accessToken);
        }
        
        const tenantResponse = await api.get('/tenants/me');
        
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
        } else {
          return { success: false, error: 'Falha ao obter dados do tenant' };
        }
      } else {
        return { success: false, error: response.error?.message || 'Login failed' };
      }
    } catch {
      return { success: false, error: 'Login failed' };
    }
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    sessionStorage.removeItem('flowdesk_access');
    queryClient.clear();
    set({ user: null, tenant: null, token: null });
  },
}));
