import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/config/api';

const TENANT_STORAGE_KEY = 'flowdesk_tenant_id';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch {
      console.error('Error saving to localStorage:', key);
    }
  };

  return [storedValue, setValue] as const;
}

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

export function usePrevious<T>(value: T): T | undefined {
  const [previous, setPrevious] = useState<T>();

  useEffect(() => {
    setPrevious(value);
  }, [value]);

  return previous;
}

// Hook para inicializar autenticaÃ§Ã£o
export function useAuthInit() {
  const { setUser, setTenant, setIsLoading } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = sessionStorage.getItem('flowdesk_access');

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const tenantResponse = await api.get('/tenants/me');
        
        if (tenantResponse.success && tenantResponse.data) {
          const tenantData = tenantResponse.data;
          const usage = tenantData.currentMonthUsage || {};
          const leadsPerMonth = usage.leads ?? usage.leadCount ?? 0;
          const messagesPerMonth = usage.messages ?? usage.messageCount ?? 0;
          const leadsPerMonthLimit = tenantData.monthlyLeadLimit ?? tenantData.leadsPerMonthLimit ?? 100;
          const waConnected = tenantData.wahaConnected ?? tenantData.waConnected ?? false;
          setTenant({
            id: tenantData.id,
            name: tenantData.name || tenantData.businessName,
            businessName: tenantData.businessName,
            plan: tenantData.plan,
            usage: {
              leadsPerMonth,
              leadsPerMonthLimit,
              messagesPerMonth,
            },
            waConnected,
            waStatus: 'disconnected',
          });
          sessionStorage.setItem(TENANT_STORAGE_KEY, tenantData.id);
          setUser({
            id: tenantData.userId,
            email: '',
            name: tenantData.name,
            tenantId: tenantData.id,
          });
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        sessionStorage.removeItem('flowdesk_access');
        sessionStorage.removeItem(TENANT_STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [setUser, setTenant, setIsLoading]);
}

