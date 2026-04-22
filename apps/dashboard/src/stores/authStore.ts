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

const ACCESS_STORAGE_KEY = 'flowdesk_access'
const TENANT_STORAGE_KEY = 'flowdesk_tenant_id'

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  tenant: null,
  token: sessionStorage.getItem(ACCESS_STORAGE_KEY),
  isLoading: true,
  setUser: (user) => set({ user }),
  setTenant: (tenant) => {
    if (tenant?.id) {
      sessionStorage.setItem(TENANT_STORAGE_KEY, tenant.id)
    } else {
      sessionStorage.removeItem(TENANT_STORAGE_KEY)
    }
    set({ tenant })
  },
  setToken: (token) => {
    if (token) {
      sessionStorage.setItem(ACCESS_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(ACCESS_STORAGE_KEY);
    }
    set({ token });
  },
  setIsLoading: (isLoading) => set({ isLoading }),
  login: async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await api.post('/auth/login', { email: normalizedEmail, password });
      
      if (response.success) {
        // Set token from response
        if (response.data?.accessToken) {
          set({ token: response.data.accessToken });
          sessionStorage.setItem(ACCESS_STORAGE_KEY, response.data.accessToken);
        }

        const selectedTenantId = response.data?.tenant?.id;
        if (selectedTenantId) {
          sessionStorage.setItem(TENANT_STORAGE_KEY, selectedTenantId);
          set({
            user: {
              id: response.data?.user?.id || selectedTenantId,
              email: normalizedEmail,
              name: response.data?.tenant?.name || normalizedEmail,
              tenantId: selectedTenantId,
            },
          });
        }
        
        const tenantResponse = await api.get('/tenants/me');
        
        if (tenantResponse.success && tenantResponse.data) {
          const tenantData = tenantResponse.data;
          const usage = tenantData.currentMonthUsage || {};
          const leadsPerMonth = usage.leads ?? usage.leadCount ?? 0;
          const messagesPerMonth = usage.messages ?? usage.messageCount ?? 0;
          const leadsPerMonthLimit = tenantData.monthlyLeadLimit ?? tenantData.leadsPerMonthLimit ?? 0;
          const waConnected = tenantData.wahaConnected ?? tenantData.waConnected ?? false;
          
          set({
            user: {
              id: tenantData.id,
              email: tenantData.owner?.email || normalizedEmail,
              name: tenantData.owner?.fullName || tenantData.name,
              tenantId: tenantData.id,
            },
            tenant: {
              id: tenantData.id,
              name: tenantData.name,
              businessName: tenantData.name,
              plan: tenantData.plan,
              usage: {
                leadsPerMonth,
                leadsPerMonthLimit,
                messagesPerMonth,
              },
              waConnected,
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
    } catch (error: any) {
      const status = error?.response?.status;
      const payload = error?.response?.data;
      const code = payload?.error?.code;
      const message = payload?.error?.message || payload?.error;

      if (status === 401 || code === 'INVALID_CREDENTIALS') {
        return { success: false, error: 'Email ou senha inválidos' };
      }

      if (status === 429 || code === 'TOO_MANY_REQUESTS') {
        return { success: false, error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' };
      }

      return { success: false, error: message || 'Falha no login. Tente novamente.' };
    }
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    sessionStorage.removeItem(ACCESS_STORAGE_KEY);
    sessionStorage.removeItem(TENANT_STORAGE_KEY);
    queryClient.clear();
    set({ user: null, tenant: null, token: null });
  },
}));
