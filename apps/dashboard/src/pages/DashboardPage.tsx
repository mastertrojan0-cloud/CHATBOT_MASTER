import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  MetricCard,
  Alert,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  Button,
} from '@/components';
import { useDashboardMetrics, useLeadsByDay, useTopInterests } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics();
  const { data: leadsByDay, isLoading: leadsLoading } = useLeadsByDay();
  const { data: topInterests, isLoading: interestsLoading } = useTopInterests();
  const { tenant } = useAuthStore();

  const usagePercentage = tenant
    ? (tenant.usage.leadsPerMonth / tenant.usage.leadsPerMonthLimit) * 100
    : 0;

  return (
    <div className="p-lg space-y-lg">
      {/* Alert Free Plan */}
      {tenant?.plan === 'free' && usagePercentage >= 80 && (
        <Alert
          type="warning"
          title="Limite próximo"
          message={`Você já usou ${Math.round(usagePercentage)}% do seu limite mensal de leads. Upgrade para Pro para limites ilimitados.`}
        />
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-lg">
        <MetricCard
          label="Leads Hoje"
          value={metrics?.leadsToday || 0}
          icon={<Users className="w-6 h-6" />}
          delta={{
            value: 12,
            isPositive: true,
          }}
        />
        <MetricCard
          label="Leads Este Mês"
          value={metrics?.leadsMonth || 0}
          icon={<TrendingUp className="w-6 h-6" />}
        />
        <MetricCard
          label="Mensagens"
          value={metrics?.messagesThisMonth || 0}
          icon={<MessageSquare className="w-6 h-6" />}
        />
        <MetricCard
          label="Taxa de Conversão"
          value={`${(metrics?.conversionRate || 0).toFixed(1)}%`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Chart */}
        <Card elevated className="lg:col-span-2 p-lg">
          <CardHeader title="Leads por Dia" subtitle="Últimos 30 dias" />
          <CardBody className="mt-md">
            {leadsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <p className="text-dark-400">Carregando...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={leadsByDay}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    stroke="#9ca3af"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1f2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#d1d5db' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke="#22c55e"
                    fillOpacity={1}
                    fill="url(#colorLeads)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        {/* Top Interests */}
        <Card elevated className="p-lg">
          <CardHeader title="Principais Interesses" />
          <CardBody className="mt-md space-y-md">
            {interestsLoading ? (
              <p className="text-dark-400">Carregando...</p>
            ) : (
              topInterests?.map((interest: any) => (
                <div key={interest.name} className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-body-md text-dark-100 font-medium">{interest.name}</p>
                    <div className="w-full bg-dark-700 rounded-full h-1 mt-xs">
                      <div
                        className="h-full bg-brand-500 rounded-full"
                        style={{ width: `${interest.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-body-sm text-dark-400 ml-md">
                    {interest.count}
                  </span>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Recent Leads */}
      <Card elevated className="p-lg">
        <CardHeader
          title="Leads Recentes"
          className="flex items-center justify-between"
        >
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="text-title-lg text-dark-100 font-display font-bold">
                Leads Recentes
              </h3>
            </div>
            <Button variant="ghost" size="sm">
              Ver Todos →
            </Button>
          </div>
        </CardHeader>

        <CardBody className="mt-md">
          <Table>
            <TableHeader>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead textAlign="right">Score</TableHead>
            </TableHeader>
            <TableBody>
              {metrics?.recentLeads?.map((lead: any) => (
                <TableRow key={lead.id}>
                  <TableCell>{lead.name}</TableCell>
                  <TableCell>{lead.phone}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        lead.status === 'qualified'
                          ? 'success'
                          : lead.status === 'interested'
                            ? 'brand'
                            : lead.status === 'lost'
                              ? 'error'
                              : 'neutral'
                      }
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell textAlign="right">
                    <div className="flex items-center gap-xs justify-end">
                      <div className="flex-1 bg-dark-700 rounded-full h-1 w-12">
                        <div
                          className="h-full bg-brand-500 rounded-full"
                          style={{ width: `${lead.score}%` }}
                        />
                      </div>
                      <span className="text-body-sm text-dark-300 w-8">
                        {lead.score}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}
