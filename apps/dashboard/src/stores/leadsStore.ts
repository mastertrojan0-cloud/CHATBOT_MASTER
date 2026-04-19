import { create } from 'zustand';
import { LeadFilters } from '@/types';

interface LeadsStore {
  filters: LeadFilters;
  page: number;
  limit: number;
  setFilters: (filters: LeadFilters) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  reset: () => void;
}

const defaultFilters: LeadFilters = {};

export const useLeadsStore = create<LeadsStore>((set) => ({
  filters: defaultFilters,
  page: 1,
  limit: 10,
  setFilters: (filters) => set({ filters, page: 1 }),
  setPage: (page) => set({ page }),
  setLimit: (limit) => set({ limit, page: 1 }),
  reset: () => set({ filters: defaultFilters, page: 1, limit: 10 }),
}));
