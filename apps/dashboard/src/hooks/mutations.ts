import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/config/api';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.put(`/leads/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead', variables.id] });
      toast.success('Lead atualizado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao atualizar lead');
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.delete(`/leads/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead deletado com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao deletar lead');
    },
  });
}

export function useExportLeadsCSV() {
  return useMutation({
    mutationFn: (filters?: any) => api.getBlob('/leads/export/csv', filters),
    onSuccess: (data) => {
      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `leads-${new Date().toISOString()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentElement?.removeChild(link);
      toast.success('Leads exportados com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao exportar leads');
    },
  });
}

export function useUpdateBusinessSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: any) => api.patch('/tenants/me', {
      name: settings.businessName,
      notifyPhone: settings.phone || null,
      notifyEmail: settings.email || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Configurações atualizadas!');
    },
    onError: () => {
      toast.error('Erro ao atualizar configurações');
    },
  });
}

export function useUpdateNotificationSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: any) => api.put('/tenants/me/notifications', settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Notificações atualizadas!');
    },
    onError: () => {
      toast.error('Erro ao atualizar notificações');
    },
  });
}

export function useConnectGoogleSheets() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spreadsheetId, sheetName }: any) =>
      api.post('/tenants/me/google-sheets', { spreadsheetId, sheetName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations', 'google-sheets'] });
      toast.success('Google Sheets conectado!');
    },
    onError: () => {
      toast.error('Erro ao conectar Google Sheets');
    },
  });
}

export function useSaveTelegramConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { botToken?: string; webhookSecret?: string; clearToken?: boolean }) =>
      api.patch('/tenants/me/telegram', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram', 'integration'] });
      queryClient.invalidateQueries({ queryKey: ['tenant'] });
      toast.success('Configuracao do Telegram salva com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erro ao salvar configuracao do Telegram');
    },
  });
}

export function useTestTelegramConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post('/tenants/me/telegram/test'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram', 'integration'] });
      toast.success('Bot do Telegram validado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erro ao testar bot do Telegram');
    },
  });
}

export function useConfigureTelegramWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (action: 'register' | 'delete') => api.post('/tenants/me/telegram/webhook', { action }),
    onSuccess: (_data, action) => {
      queryClient.invalidateQueries({ queryKey: ['telegram', 'integration'] });
      toast.success(action === 'register' ? 'Webhook do Telegram ativado!' : 'Webhook do Telegram removido!');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.error || 'Erro ao configurar webhook do Telegram');
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const authStore = useAuthStore();

  return useMutation({
    mutationFn: () => authStore.logout(),
    onSuccess: () => {
      queryClient.clear();
      window.location.href = '/login';
    },
    onError: () => {
      toast.error('Erro ao fazer logout');
    },
  });
}
