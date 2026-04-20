import { create } from 'zustand';
import { Tenant, User } from '@/types';
import api from '@/config/api';

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
      console.log('[Auth] Iniciando login para:', email);
      const response = await api.post('/auth/login', { email, password });
      if (response?.success && response?.data?.accessToken) {
        sessionStorage.setItem('flowdesk_access', response.data.accessToken);
      }
      console.log('[Auth] Resposta da API login:', response);
      
      if (response.success) {
        // Set token from response
        if (response.data?.accessToken) {
          set({ token: response.data.accessToken });
        }
        
        console.log('[Auth] Login bem-sucedido, obtendo tenant...');
        const tenantResponse = await api.get('/tenants/me');
        console.log('[Auth] Resposta da API tenant:', tenantResponse);
        
        if (tenantResponse.success && tenantResponse.data) {
          const tenantData = tenantResponse.data;
          console.log('[Auth] Dados do tenant:', tenantData);
          
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
          console.log('[Auth] Login completado com sucesso');
          return { success: true };
        } else {
          console.log('[Auth] Erro: Resposta do tenant não contém dados válidos', tenantResponse);
          return { success: false, error: 'Falha ao obter dados do tenant' };
        }
      } else {
        console.log('[Auth] Erro: Login retornou success=false', response);
        return { success: false, error: response.error?.message || 'Login failed' };
      }
    } catch (error) {
      console.error('[Auth] Exceção no login:', error);
      return { success: false, error: 'Login failed' };
    }
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    sessionStorage.removeItem('flowdesk_access');
    set({ user: null, tenant: null, token: null });
  },
}));
