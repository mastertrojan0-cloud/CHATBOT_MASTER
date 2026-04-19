import React, { useState } from 'react';
import { Settings, Bell, Zap, Lock } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Input,
  Button,
  Alert,
  Badge,
} from '@/components';
import {
  useUpdateBusinessSettings,
  useUpdateNotificationSettings,
  useConnectGoogleSheets,
} from '@/hooks/mutations';
import { useTenant, useGoogleSheetsConfig } from '@/hooks/queries';
import { useAuthStore } from '@/stores/authStore';

export default function SettingsPage() {
  const { tenant } = useAuthStore();
  const { data: tenantData } = useTenant();
  const { data: sheetsConfig } = useGoogleSheetsConfig();
  const updateBusinessMutation = useUpdateBusinessSettings();
  const updateNotificationsMutation = useUpdateNotificationSettings();
  const connectSheetsMutation = useConnectGoogleSheets();

  const [businessSettings, setBusinessSettings] = useState({
    businessName: tenantData?.businessName || '',
    industry: tenantData?.industry || '',
    phone: tenantData?.phone || '',
    email: tenantData?.email || '',
    website: tenantData?.website || '',
  });

  const [notificationSettings, setNotificationSettings] = useState({
    waNotifications: tenantData?.notifications?.waNotifications || false,
    emailNotifications: tenantData?.notifications?.emailNotifications || false,
    newLeadAlert: tenantData?.notifications?.newLeadAlert || false,
    messageAlert: tenantData?.notifications?.messageAlert || false,
  });

  const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState(
    sheetsConfig?.spreadsheetId || ''
  );
  const [sheetsSheetName, setSheetsSheetName] = useState(sheetsConfig?.sheetName || '');

  const handleBusinessChange = (field: string, value: string) => {
    setBusinessSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotificationSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveBusinessSettings = () => {
    updateBusinessMutation.mutate(businessSettings);
  };

  const handleSaveNotifications = () => {
    updateNotificationsMutation.mutate(notificationSettings);
  };

  const handleConnectSheets = () => {
    connectSheetsMutation.mutate({
      spreadsheetId: sheetsSpreadsheetId,
      sheetName: sheetsSheetName,
    });
  };

  const isPro = tenant?.plan === 'pro';

  return (
    <div className="p-lg space-y-lg max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-display-md font-display font-bold text-dark-100 flex items-center gap-md">
          <Settings className="w-8 h-8 text-brand-500" />
          Configurações
        </h1>
        <p className="text-body-md text-dark-400 mt-xs">
          Gerencie os dados do seu negócio e preferências
        </p>
      </div>

      {/* Business Settings */}
      <Card elevated className="p-lg">
        <CardHeader title="Dados do Negócio" subtitle="Informações sobre sua empresa" />
        <CardBody className="mt-md space-y-md">
          <Input
            label="Nome do Negócio"
            value={businessSettings.businessName}
            onChange={(e) => handleBusinessChange('businessName', e.target.value)}
            placeholder="Sua empresa"
          />
          <Input
            label="Indústria"
            value={businessSettings.industry}
            onChange={(e) => handleBusinessChange('industry', e.target.value)}
            placeholder="Ex: Tecnologia, Saúde, Educação"
          />
          <Input
            label="Telefone"
            value={businessSettings.phone}
            onChange={(e) => handleBusinessChange('phone', e.target.value)}
            placeholder="(11) 98765-4321"
          />
          <Input
            label="Email"
            type="email"
            value={businessSettings.email}
            onChange={(e) => handleBusinessChange('email', e.target.value)}
            placeholder="seu@email.com"
          />
          <Input
            label="Website"
            value={businessSettings.website}
            onChange={(e) => handleBusinessChange('website', e.target.value)}
            placeholder="https://seusite.com"
          />
        </CardBody>
        <CardFooter>
          <Button
            variant="primary"
            isLoading={updateBusinessMutation.isPending}
            onClick={handleSaveBusinessSettings}
          >
            Salvar Alterações
          </Button>
        </CardFooter>
      </Card>

      {/* Notification Settings */}
      <Card elevated className="p-lg">
        <CardHeader
          title="Notificações"
          subtitle={isPro ? 'Receba alertas via WhatsApp e Email' : 'Disponível apenas no plano Pro'}
        />
        <CardBody className="mt-md space-y-md">
          {!isPro && (
            <Alert
              type="warning"
              title="Recurso Pro"
              message="Este recurso está disponível apenas para clientes do plano Pro. Upgrade agora para acessar."
            />
          )}

          <div className="flex items-center justify-between p-md bg-dark-700/50 rounded-md">
            <div>
              <p className="text-body-md font-medium text-dark-100">
                Notificações por WhatsApp
              </p>
              <p className="text-body-sm text-dark-400">
                Receba alertas de novos leads no WhatsApp
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.waNotifications}
              onChange={(e) => handleNotificationChange('waNotifications', e.target.checked)}
              disabled={!isPro}
              className="w-5 h-5 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-md bg-dark-700/50 rounded-md">
            <div>
              <p className="text-body-md font-medium text-dark-100">
                Notificações por Email
              </p>
              <p className="text-body-sm text-dark-400">
                Receba relatórios diários por email
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.emailNotifications}
              onChange={(e) =>
                handleNotificationChange('emailNotifications', e.target.checked)
              }
              disabled={!isPro}
              className="w-5 h-5 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-md bg-dark-700/50 rounded-md">
            <div>
              <p className="text-body-md font-medium text-dark-100">
                Alertas de Novo Lead
              </p>
              <p className="text-body-sm text-dark-400">
                Ser notificado quando um novo lead chegar
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.newLeadAlert}
              onChange={(e) => handleNotificationChange('newLeadAlert', e.target.checked)}
              disabled={!isPro}
              className="w-5 h-5 cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between p-md bg-dark-700/50 rounded-md">
            <div>
              <p className="text-body-md font-medium text-dark-100">
                Alertas de Mensagem
              </p>
              <p className="text-body-sm text-dark-400">
                Ser notificado de novas mensagens
              </p>
            </div>
            <input
              type="checkbox"
              checked={notificationSettings.messageAlert}
              onChange={(e) => handleNotificationChange('messageAlert', e.target.checked)}
              disabled={!isPro}
              className="w-5 h-5 cursor-pointer"
            />
          </div>
        </CardBody>
        {isPro && (
          <CardFooter>
            <Button
              variant="primary"
              isLoading={updateNotificationsMutation.isPending}
              onClick={handleSaveNotifications}
            >
              Salvar Notificações
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Google Sheets Integration */}
      <Card elevated className="p-lg">
        <CardHeader
          title="Google Sheets"
          subtitle={isPro ? 'Sincronize seus leads com Google Sheets' : 'Disponível apenas no plano Pro'}
        />
        <CardBody className="mt-md space-y-md">
          {sheetsConfig?.connected && (
            <Alert
              type="success"
              title="Conectado"
              message={`Seus leads estão sendo sincronizados com a planilha "${sheetsConfig.sheetName}"`}
            />
          )}

          {!isPro && (
            <Alert
              type="warning"
              title="Recurso Pro"
              message="Este recurso está disponível apenas para clientes do plano Pro. Upgrade agora para acessar."
            />
          )}

          <Input
            label="ID da Planilha"
            disabled={!isPro}
            value={sheetsSpreadsheetId}
            onChange={(e) => setSheetsSpreadsheetId(e.target.value)}
            placeholder="ID da sua planilha do Google Sheets"
            helperText="Você pode encontrar o ID na URL da sua planilha"
          />

          <Input
            label="Nome da Aba"
            disabled={!isPro}
            value={sheetsSheetName}
            onChange={(e) => setSheetsSheetName(e.target.value)}
            placeholder="Ex: Leads, Contatos"
          />
        </CardBody>
        {isPro && (
          <CardFooter>
            <Button
              variant="primary"
              isLoading={connectSheetsMutation.isPending}
              onClick={handleConnectSheets}
            >
              Conectar Google Sheets
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* Plan Card */}
      <Card elevated className="p-lg bg-gradient-to-br from-brand-900 to-dark-800 border-brand-700">
        <CardHeader title="Seu Plano" subtitle="Gerencie sua assinatura" />
        <CardBody className="mt-md space-y-md">
          <div className="flex items-center justify-between p-md bg-dark-900/50 rounded-md">
            <div className="flex items-center gap-md">
              <Zap className="w-6 h-6 text-brand-400" />
              <div>
                <p className="text-body-md font-semibold text-dark-100">
                  {isPro ? 'Plano Pro' : 'Plano Free'}
                </p>
                <p className="text-body-sm text-dark-400">
                  {isPro ? 'Acesso completo a todos os recursos' : 'Funcionalidades limitadas'}
                </p>
              </div>
            </div>
            <Badge variant={isPro ? 'brand' : 'neutral'}>
              {isPro ? 'Ativo' : 'Limitado'}
            </Badge>
          </div>

          {!isPro && (
            <div className="space-y-md p-md bg-dark-900/50 rounded-md border border-brand-500/20">
              <h4 className="text-body-md font-semibold text-dark-100">
                Funcionalidades Pro:
              </h4>
              <ul className="space-y-xs text-body-sm text-dark-300">
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">✓</span>
                  <span>Notificações por WhatsApp e Email</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">✓</span>
                  <span>Sincronização com Google Sheets</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">✓</span>
                  <span>Exportação de Leads em CSV</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">✓</span>
                  <span>Leads ilimitados por mês</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">✓</span>
                  <span>Suporte prioritário</span>
                </li>
              </ul>
              <Button variant="primary" className="w-full mt-md">
                Fazer Upgrade para Pro
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
