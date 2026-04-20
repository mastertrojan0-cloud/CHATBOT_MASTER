import React, { useState } from 'react';
import { Search, Download, ExternalLink } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  Input,
  Select,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components';
import { useLeads } from '@/hooks/queries';
import { useLeadsStore } from '@/stores/leadsStore';
import { useExportLeadsCSV, useUpdateLead } from '@/hooks/mutations';
import { useAuthStore } from '@/stores/authStore';
import { useDebounce } from '@/hooks';

export default function LeadsPage() {
  const { filters, page, limit, setFilters, setPage } = useLeadsStore();
  const [searchText, setSearchText] = useState('');
  const debouncedSearch = useDebounce(searchText, 500);
  const { tenant } = useAuthStore();

  const { data: leadsData, isLoading } = useLeads(page, limit, {
    ...filters,
    search: debouncedSearch,
  });

  const updateLeadMutation = useUpdateLead();
  const exportMutation = useExportLeadsCSV();

  const isPro = tenant?.plan === 'pro';

  const handleStatusChange = (leadId: string, newStatus: string) => {
    updateLeadMutation.mutate({
      id: leadId,
      data: { status: newStatus },
    });
  };

  const handleExport = () => {
    if (!isPro) return; // Only Pro can export
    exportMutation.mutate(filters);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setFilters({ ...filters, search: value });
    setPage(1);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  };

  const leadsPayload = (leadsData as any)?.data || leadsData || {};
  const safeLeads = Array.isArray(leadsPayload?.data) ? leadsPayload.data : [];
  const totalPages = typeof leadsPayload?.pagination?.pages === 'number' ? leadsPayload.pagination.pages : 1;
  const totalLeads = typeof leadsPayload?.pagination?.total === 'number' ? leadsPayload.pagination.total : 0;

  return (
    <div className="p-lg space-y-lg">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-display font-bold text-dark-100">Leads</h1>
          <p className="text-body-md text-dark-400 mt-xs">
            {totalLeads} leads no total
          </p>
        </div>

        <Button
          variant={isPro ? 'primary' : 'outline'}
          disabled={!isPro}
          isLoading={exportMutation.isPending}
          onClick={handleExport}
          className="flex items-center gap-md"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
          />

          <Select
            options={[
              { value: '', label: 'Todos os status' },
              { value: 'new', label: 'Novo' },
              { value: 'contacted', label: 'Contatado' },
              { value: 'interested', label: 'Interessado' },
              { value: 'qualified', label: 'Qualificado' },
              { value: 'lost', label: 'Perdido' },
            ]}
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          />

          <div className="flex gap-md">
            <Button variant="outline" size="sm">
              Mais Filtros
            </Button>
            {Object.values(filters).some((v) => v) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters({});
                  setSearchText('');
                }}
              >
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card elevated className="p-lg">
        <CardBody>
          {isLoading ? (
            <div className="flex items-center justify-center py-lg">
              <p className="text-dark-400">Carregando leads...</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead textAlign="center">Score</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead textAlign="center">Ações</TableHead>
                </TableHeader>
                <TableBody>
                  {safeLeads.map((lead: any) => {
                    const leadName = typeof lead?.name === 'string' ? lead.name : '';
                    const leadEmail = typeof lead?.email === 'string' ? lead.email : '';
                    const leadPhone = typeof lead?.phone === 'string' ? lead.phone : '';
                    const leadStatus = typeof lead?.status === 'string' ? lead.status : 'new';
                    const leadScore = typeof lead?.score === 'number' ? lead.score : 0;
                    const leadCreatedAt = lead?.createdAt ? new Date(lead.createdAt) : null;

                    return (
                    <TableRow key={lead?.id || `${leadPhone}-${leadName}`}>
                      <TableCell>
                        <div>
                          <p className="text-body-md font-medium text-dark-100">
                            {leadName}
                          </p>
                          {leadEmail && (
                            <p className="text-body-sm text-dark-400">{leadEmail}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{leadPhone}</TableCell>
                      <TableCell>
                        <Select
                          options={[
                            { value: 'new', label: 'Novo' },
                            { value: 'contacted', label: 'Contatado' },
                            { value: 'interested', label: 'Interessado' },
                            { value: 'qualified', label: 'Qualificado' },
                            { value: 'lost', label: 'Perdido' },
                          ]}
                          value={leadStatus}
                          onChange={(e) =>
                            handleStatusChange(lead.id, e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell textAlign="center">
                        <div className="flex items-center gap-xs justify-center">
                          <div className="flex-1 bg-dark-700 rounded-full h-1 w-12">
                            <div
                              className="h-full bg-brand-500 rounded-full"
                              style={{ width: `${leadScore}%` }}
                            />
                          </div>
                          <span className="text-body-sm text-dark-300 w-8">
                            {leadScore}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-dark-400">
                        {leadCreatedAt && !Number.isNaN(leadCreatedAt.getTime())
                          ? leadCreatedAt.toLocaleDateString('pt-BR')
                          : ''}
                      </TableCell>
                      <TableCell textAlign="center">
                        <a
                          href={`https://wa.me/${leadPhone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-xs justify-center text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span className="text-body-sm">WhatsApp</span>
                        </a>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-lg pt-lg border-t border-dark-700">
                <p className="text-body-sm text-dark-400">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-md">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(page + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
