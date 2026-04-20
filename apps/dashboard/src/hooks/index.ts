import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/config/api';

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
          setTenant({
            id: tenantData.id,
            name: tenantData.name || tenantData.businessName,
            businessName: tenantData.businessName,
            plan: tenantData.plan,
            usage: {
              leadsPerMonth: 0,
              leadsPerMonthLimit: tenantData.leadsPerMonthLimit || 100,
              messagesPerMonth: 0,
            },
            waConnected: tenantData.waConnected,
            waStatus: 'disconnected',
          });
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
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, [setUser, setTenant, setIsLoading]);
}

