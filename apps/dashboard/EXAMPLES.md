// Exemplo de como usar a estrutura do dashboard

// ============================================
// 1. HOOKS DE QUERY (Dados)
// ============================================

// Em um componente React
import { useDashboardMetrics, useLeads } from '@/hooks/queries';

function MyComponent() {
  // Buscar dados
  const { data: metrics, isLoading } = useDashboardMetrics();
  const { data: leads, isLoading: leadsLoading } = useLeads(1, 10);

  if (isLoading) return <div>Carregando...</div>;
  
  return (
    <div>
      <p>Leads hoje: {metrics?.leadsToday}</p>
    </div>
  );
}

// ============================================
// 2. HOOKS DE MUTATION (Ações)
// ============================================

import { useUpdateLead, useExportLeadsCSV } from '@/hooks/mutations';

function LeadActions() {
  const updateLead = useUpdateLead();
  const exportCSV = useExportLeadsCSV();

  const handleStatusChange = (leadId: string, newStatus: string) => {
    // Atualizar lead (automáticamente invalida queries)
    updateLead.mutate({
      id: leadId,
      data: { status: newStatus },
    });
  };

  const handleExport = () => {
    // Exportar leads em CSV
    exportCSV.mutate({
      status: 'interested', // Filtros opcionais
    });
  };

  return (
    <>
      <button onClick={() => handleStatusChange('123', 'qualified')}>
        {updateLead.isPending ? 'Atualizando...' : 'Atualizar'}
      </button>
      <button onClick={handleExport}>
        {exportCSV.isPending ? 'Exportando...' : 'Exportar CSV'}
      </button>
    </>
  );
}

// ============================================
// 3. ZUSTAND STORES (Estado Global)
// ============================================

import { useAuthStore } from '@/stores/authStore';
import { useLeadsStore } from '@/stores/leadsStore';

function MyComponent() {
  // Auth store
  const { user, tenant, logout } = useAuthStore();
  
  // Leads store
  const { filters, page, setFilters, setPage } = useLeadsStore();

  return (
    <div>
      <p>Tenant: {tenant?.businessName}</p>
      <p>Plano: {tenant?.plan}</p>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => setPage(page + 1)}>Próxima página</button>
    </div>
  );
}

// ============================================
// 4. COMPONENTES REUTILIZÁVEIS
// ============================================

import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Badge,
  Input,
  Select,
  MetricCard,
  Alert,
} from '@/components';

function ComponentsExample() {
  return (
    <div className="space-y-md">
      {/* Button */}
      <Button variant="primary" size="md" onClick={() => alert('Click!')}>
        Clique aqui
      </Button>

      {/* Card */}
      <Card elevated>
        <CardHeader title="Meu Card" subtitle="Subtítulo opcional" />
        <CardBody>Conteúdo do card</CardBody>
      </Card>

      {/* Badge */}
      <Badge variant="success">Sucesso</Badge>
      <Badge variant="error">Erro</Badge>

      {/* Input */}
      <Input
        label="Seu nome"
        placeholder="Digite seu nome"
        error="Campo obrigatório"
      />

      {/* Select */}
      <Select
        label="Status"
        options={[
          { value: 'new', label: 'Novo' },
          { value: 'qualified', label: 'Qualificado' },
        ]}
      />

      {/* Metric Card */}
      <MetricCard
        label="Leads Hoje"
        value={42}
        delta={{ value: 12, isPositive: true }}
      />

      {/* Alert */}
      <Alert
        type="warning"
        title="Atenção"
        message="Você está próximo do limite"
      />
    </div>
  );
}

// ============================================
// 5. HOOKS CUSTOMIZADOS
// ============================================

import { useLocalStorage, useDebounce, usePrevious } from '@/hooks';

function HooksExample() {
  // Local storage
  const [theme, setTheme] = useLocalStorage('theme', 'dark');

  // Debounce para busca
  const [searchText, setSearchText] = React.useState('');
  const debouncedSearch = useDebounce(searchText, 500);

  // Previous value
  const previousPage = usePrevious(currentPage);

  return (
    <div>
      <input
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        placeholder="Buscar..."
      />
      {/* Busca será executada após 500ms de inatividade */}
    </div>
  );
}

// ============================================
// 6. FUNÇÕES UTILITÁRIAS
// ============================================

import {
  formatPhone,
  formatDate,
  formatCurrency,
  truncateText,
  getStatusColor,
} from '@/utils';

function UtilsExample() {
  const phone = formatPhone('11987654321'); // (11) 98765-4321
  const date = formatDate(new Date()); // 25 de dez. de 2024
  const currency = formatCurrency(1000); // R$ 1.000,00
  const text = truncateText('Texto muito longo', 10); // Texto mui...
  
  return <div>Exemplos de formatação</div>;
}

// ============================================
// 7. ROTEAMENTO TANSTACK
// ============================================

// Navegação
import { useRouter } from '@tanstack/react-router';

function Navigation() {
  const router = useRouter();

  return (
    <button onClick={() => router.navigate({ to: '/leads' })}>
      Ir para Leads
    </button>
  );
}

// Link
import { Link } from '@tanstack/react-router';

function LinkExample() {
  return (
    <Link to="/" activeProps={{ className: 'font-bold' }}>
      Dashboard
    </Link>
  );
}

// ============================================
// 8. NOTIFICAÇÕES (SONNER)
// ============================================

import { toast } from 'sonner';

function NotificationExample() {
  return (
    <>
      <button onClick={() => toast.success('Sucesso!')}>
        Show success
      </button>
      <button onClick={() => toast.error('Erro!')}>
        Show error
      </button>
      <button onClick={() => toast.loading('Carregando...')}>
        Show loading
      </button>
    </>
  );
}

// ============================================
// 9. TIPOS TYPESCRIPT
// ============================================

import { Lead, Tenant, DashboardMetrics, PaginatedResponse } from '@/types';

function TypeExample() {
  const tenant: Tenant = {
    id: '1',
    name: 'Empresa',
    businessName: 'Minha Empresa',
    plan: 'pro',
    usage: {
      leadsPerMonth: 50,
      leadsPerMonthLimit: 100,
      messagesPerMonth: 200,
    },
    waConnected: true,
    waStatus: 'connected',
  };

  const lead: Lead = {
    id: '1',
    name: 'João Silva',
    phone: '11987654321',
    email: 'joao@example.com',
    status: 'interested',
    score: 85,
    interests: ['Produto A', 'Produto B'],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return <div>Tipos TypeScript bem definidos</div>;
}

export {};
