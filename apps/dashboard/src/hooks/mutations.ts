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
    mutationFn: (settings: any) => api.put('/tenants/me', settings),
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
