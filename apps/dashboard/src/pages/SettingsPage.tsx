import React, { useEffect, useState } from 'react';
import { Settings, Zap } from 'lucide-react';
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

type BusinessSettingsState = {
  businessName: string;
  industry: string;
  phone: string;
  email: string;
  website: string;
};

type NotificationSettingsState = {
  waNotifications: boolean;
  emailNotifications: boolean;
  newLeadAlert: boolean;
  messageAlert: boolean;
};

export default function SettingsPage() {
  const { tenant } = useAuthStore();
  const isPro = tenant?.plan === 'pro';
  const { data: tenantData } = useTenant();
  const { data: sheetsConfig } = useGoogleSheetsConfig(isPro);
  const updateBusinessMutation = useUpdateBusinessSettings();
  const updateNotificationsMutation = useUpdateNotificationSettings();
  const connectSheetsMutation = useConnectGoogleSheets();

  const tenantInfo = (tenantData as any)?.data || tenantData || {};
  const notificationsInfo = tenantInfo?.notifications || {};
  const sheetsInfo = (sheetsConfig as any)?.data || sheetsConfig || {};

  const [businessSettings, setBusinessSettings] = useState<BusinessSettingsState>({
    businessName: '',
    industry: '',
    phone: '',
    email: '',
    website: '',
  });

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettingsState>({
    waNotifications: false,
    emailNotifications: false,
    newLeadAlert: false,
    messageAlert: false,
  });

  const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState('');
  const [sheetsSheetName, setSheetsSheetName] = useState('');

  useEffect(() => {
    setBusinessSettings({
      businessName: typeof tenantInfo?.name === 'string' ? tenantInfo.name : '',
      industry: typeof tenantInfo?.businessSegment === 'string' ? tenantInfo.businessSegment : '',
      phone: typeof tenantInfo?.notifyPhone === 'string' ? tenantInfo.notifyPhone : '',
      email: typeof tenantInfo?.notifyEmail === 'string' ? tenantInfo.notifyEmail : '',
      website: '',
    });

    setNotificationSettings({
      waNotifications: typeof notificationsInfo?.waNotifications === 'boolean' ? notificationsInfo.waNotifications : false,
      emailNotifications: typeof notificationsInfo?.emailNotifications === 'boolean' ? notificationsInfo.emailNotifications : false,
      newLeadAlert: typeof notificationsInfo?.newLeadAlert === 'boolean' ? notificationsInfo.newLeadAlert : false,
      messageAlert: typeof notificationsInfo?.messageAlert === 'boolean' ? notificationsInfo.messageAlert : false,
    });
  }, [tenantInfo, notificationsInfo]);

  useEffect(() => {
    setSheetsSpreadsheetId(typeof sheetsInfo?.spreadsheetId === 'string' ? sheetsInfo.spreadsheetId : '');
    setSheetsSheetName(typeof sheetsInfo?.sheetName === 'string' ? sheetsInfo.sheetName : '');
  }, [sheetsInfo]);

  const handleBusinessChange = (field: keyof BusinessSettingsState, value: string) => {
    setBusinessSettings((prev) => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: keyof NotificationSettingsState, value: boolean) => {
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

  const notificationOptions: Array<{
    id: keyof NotificationSettingsState extends infer T ? string : string;
    field: keyof NotificationSettingsState;
    title: string;
    description: string;
  }> = [
    {
      id: 'wa-notifications',
      field: 'waNotifications',
      title: 'Notificacoes por WhatsApp',
      description: 'Receba alertas de novos leads no WhatsApp',
    },
    {
      id: 'email-notifications',
      field: 'emailNotifications',
      title: 'Notificacoes por Email',
      description: 'Receba relatorios diarios por email',
    },
    {
      id: 'new-lead-alert',
      field: 'newLeadAlert',
      title: 'Alertas de Novo Lead',
      description: 'Ser notificado quando um novo lead chegar',
    },
    {
      id: 'message-alert',
      field: 'messageAlert',
      title: 'Alertas de Mensagem',
      description: 'Ser notificado de novas mensagens',
    },
  ];

  return (
    <div className="p-lg space-y-lg max-w-4xl">
      <div>
        <h1 className="text-display-md font-display font-bold text-dark-100 flex items-center gap-md">
          <Settings className="w-8 h-8 text-brand-500" />
          Configuracoes
        </h1>
        <p className="text-body-md text-dark-400 mt-xs">
          Gerencie os dados do seu negocio e preferencias
        </p>
      </div>

      <Card elevated className="p-lg">
        <CardHeader title="Dados do Negocio" subtitle="Informacoes sobre sua empresa" />
        <CardBody className="mt-md space-y-md">
          <Input
            id="business-name"
            name="businessName"
            label="Nome do Negocio"
            value={businessSettings.businessName}
            onChange={(e) => handleBusinessChange('businessName', e.target.value)}
            placeholder="Sua empresa"
          />
          <Input
            id="business-industry"
            name="industry"
            label="Industria"
            value={businessSettings.industry}
            onChange={(e) => handleBusinessChange('industry', e.target.value)}
            placeholder="Ex: Tecnologia, Saude, Educacao"
          />
          <Input
            id="business-phone"
            name="phone"
            label="Telefone"
            value={businessSettings.phone}
            onChange={(e) => handleBusinessChange('phone', e.target.value)}
            placeholder="(11) 98765-4321"
          />
          <Input
            id="business-email"
            name="email"
            label="Email"
            type="email"
            value={businessSettings.email}
            onChange={(e) => handleBusinessChange('email', e.target.value)}
            placeholder="seu@email.com"
          />
          <Input
            id="business-website"
            name="website"
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
            Salvar Alteracoes
          </Button>
        </CardFooter>
      </Card>

      <Card elevated className="p-lg">
        <CardHeader
          title="Notificacoes"
          subtitle={isPro ? 'Receba alertas via WhatsApp e Email' : 'Disponivel apenas no plano Pro'}
        />
        <CardBody className="mt-md space-y-md">
          {!isPro && (
            <Alert
              type="warning"
              title="Recurso Pro"
              message="Este recurso esta disponivel apenas para clientes do plano Pro. Upgrade agora para acessar."
            />
          )}

          {notificationOptions.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-md p-md bg-dark-700/50 rounded-md">
              <label htmlFor={item.id} className="flex-1 cursor-pointer">
                <p className="text-body-md font-medium text-dark-100">{item.title}</p>
                <p className="text-body-sm text-dark-400">{item.description}</p>
              </label>
              <input
                id={item.id}
                name={item.id}
                type="checkbox"
                checked={notificationSettings[item.field]}
                onChange={(e) => handleNotificationChange(item.field, e.target.checked)}
                disabled={!isPro}
                className="w-5 h-5 cursor-pointer"
              />
            </div>
          ))}
        </CardBody>
        {isPro && (
          <CardFooter>
            <Button
              variant="primary"
              isLoading={updateNotificationsMutation.isPending}
              onClick={handleSaveNotifications}
            >
              Salvar Notificacoes
            </Button>
          </CardFooter>
        )}
      </Card>

      {isPro ? (
        <Card elevated className="p-lg">
          <CardHeader
            title="Google Sheets"
            subtitle="Sincronize seus leads com Google Sheets"
          />
          <CardBody className="mt-md space-y-md">
            {Boolean(sheetsInfo?.connected) && (
              <Alert
                type="success"
                title="Conectado"
                message={`Seus leads estao sendo sincronizados com a planilha "${typeof sheetsInfo?.sheetName === 'string' ? sheetsInfo.sheetName : ''}"`}
              />
            )}

            <Input
              id="sheets-spreadsheet-id"
              name="spreadsheetId"
              label="ID da Planilha"
              value={sheetsSpreadsheetId}
              onChange={(e) => setSheetsSpreadsheetId(e.target.value)}
              placeholder="ID da sua planilha do Google Sheets"
              helperText="Voce pode encontrar o ID na URL da sua planilha"
            />

            <Input
              id="sheets-sheet-name"
              name="sheetName"
              label="Nome da Aba"
              value={sheetsSheetName}
              onChange={(e) => setSheetsSheetName(e.target.value)}
              placeholder="Ex: Leads, Contatos"
            />
          </CardBody>
          <CardFooter>
            <Button
              variant="primary"
              isLoading={connectSheetsMutation.isPending}
              onClick={handleConnectSheets}
            >
              Conectar Google Sheets
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <div className="border border-yellow-500/30 rounded-lg p-4 bg-yellow-500/10">
          <p className="text-yellow-400 text-sm">
            Integracoes disponiveis no plano Pro
          </p>
          <button className="mt-2 text-xs text-brand-400 underline">
            Fazer upgrade {'->'}
          </button>
        </div>
      )}

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
                  <span className="text-brand-400">+</span>
                  <span>Notificacoes por WhatsApp e Email</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">+</span>
                  <span>Sincronizacao com Google Sheets</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">+</span>
                  <span>Exportacao de Leads em CSV</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">+</span>
                  <span>Leads ilimitados por mes</span>
                </li>
                <li className="flex items-center gap-xs">
                  <span className="text-brand-400">+</span>
                  <span>Suporte prioritario</span>
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
