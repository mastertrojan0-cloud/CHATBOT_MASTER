import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Loader, RefreshCw, Send, Copy, Bot } from 'lucide-react';
import QRCode from 'qrcode.react';
import { Card, CardHeader, CardBody, Alert, Badge, Button, ConfirmDialog, Input } from '@/components';
import { useWAHASession, useWAHAQR, useTelegramIntegration } from '@/hooks/queries';
import { useConfigureTelegramWebhook, useSaveTelegramConfig, useTestTelegramConfig, useTestWhatsAppBot } from '@/hooks/mutations';
import api from '@/config/api';
import { useQueryClient } from '@tanstack/react-query';

const INACTIVE_STATUSES = ['STOPPED', 'FAILED', ''];
const SCANNING_STATUS = 'SCAN_QR_CODE';
const CONNECTED_STATUSES = ['WORKING'];
const LOADING_STATUSES = ['STARTING'];
const STUCK_STATUSES = ['SCAN_QR_CODE', 'STARTING'];

function statusLabel(status: string): string {
  if (status === 'WORKING') return 'WhatsApp conectado com sucesso!';
  if (status === SCANNING_STATUS) return 'Escaneie o QR code com seu WhatsApp';
  if (status === 'STARTING') return 'Iniciando conexao com WhatsApp...';
  if (status === 'STOPPED') return 'WhatsApp desconectado';
  if (status === 'FAILED') return 'Falha na conexao. Clique em Conectar para tentar novamente.';
  if (!status) return 'Carregando...';
  return `Aguardando... (${status})`;
}

export default function ConnectPage() {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [botTestMessage, setBotTestMessage] = useState('oi');
  const [botTestResetContext, setBotTestResetContext] = useState(true);
  const [botTestResult, setBotTestResult] = useState<null | {
    input: string;
    response: string;
    lead: Record<string, unknown> | null;
    usedExistingConversation: boolean;
    resetContext: boolean;
  }>(null);
  const [telegramCopyFeedback, setTelegramCopyFeedback] = useState<string | null>(null);
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramWebhookSecret, setTelegramWebhookSecret] = useState('');
  const fastPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stuckTimer, setStuckTimer] = useState(0);

  const {
    data: sessionData,
    isError: sessionError,
    refetch: refetchSession,
  } = useWAHASession();
  const shouldPollQr =
    sessionError ||
    isConnecting ||
    isReconnecting ||
    isResetting ||
    sessionData?.status === SCANNING_STATUS ||
    sessionData?.status === 'STARTING';
  const { data: qrImageData } = useWAHAQR(shouldPollQr);
  const {
    data: telegramIntegration,
    isError: telegramIntegrationError,
  } = useTelegramIntegration();
  const saveTelegramConfigMutation = useSaveTelegramConfig();
  const testTelegramConfigMutation = useTestTelegramConfig();
  const configureTelegramWebhookMutation = useConfigureTelegramWebhook();
  const testWhatsAppBotMutation = useTestWhatsAppBot();

  const sessionStatus = sessionData?.status || '';
  const isScanning = sessionStatus === SCANNING_STATUS;
  const isConnected = CONNECTED_STATUSES.includes(sessionStatus);
  const isLoading = LOADING_STATUSES.includes(sessionStatus);
  const canConnect = INACTIVE_STATUSES.includes(sessionStatus);
  const isStuck = STUCK_STATUSES.includes(sessionStatus) && stuckTimer > 20;

  const qrImage = qrImageData?.kind === 'image' ? qrImageData.value : null;
  const qrText = qrImageData?.kind === 'text' ? qrImageData.value : null;

  useEffect(() => {
    return () => {
      if (qrImage?.startsWith('blob:')) {
        URL.revokeObjectURL(qrImage);
      }
    };
  }, [qrImage]);

  useEffect(() => {
    setTelegramBotToken('');
    setTelegramWebhookSecret('');
  }, [telegramIntegration?.tokenPreview]);

  const startFastPoll = () => {
    if (fastPollRef.current) clearInterval(fastPollRef.current);
    let count = 0;
    fastPollRef.current = setInterval(() => {
      count++;
      queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
      if (count >= 180) {
        clearInterval(fastPollRef.current!);
        fastPollRef.current = null;
      }
    }, 500);
  };

  useEffect(() => {
    if (sessionStatus === SCANNING_STATUS && !fastPollRef.current) {
      startFastPoll();
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus === SCANNING_STATUS) {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
    }

    if (sessionStatus === 'WORKING') {
      setActionError(null);
    }
  }, [queryClient, sessionStatus]);

  useEffect(() => {
    if (STUCK_STATUSES.includes(sessionStatus)) {
      const timer = setInterval(() => setStuckTimer((n) => n + 1), 1000);
      return () => clearInterval(timer);
    }

    setStuckTimer(0);
  }, [sessionStatus]);

  useEffect(() => {
    return () => {
      if (fastPollRef.current) clearInterval(fastPollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!telegramCopyFeedback) return;

    const timer = setTimeout(() => setTelegramCopyFeedback(null), 2000);
    return () => clearTimeout(timer);
  }, [telegramCopyFeedback]);

  function extractErrorMessage(error: any, fallback: string): string {
    const data = error?.response?.data;
    if (!data) return error?.message || fallback;
    const err = data.error;
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object') return err.message || fallback;
    return fallback;
  }

  const handleConnect = async () => {
    setIsConnecting(true);
    setActionError(null);
    try {
      await api.post('/sessions/connect');
      startFastPoll();
      queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
      await refetchSession();
    } catch (error: any) {
      setActionError(extractErrorMessage(error, 'Falha ao iniciar conexao com WhatsApp'));
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    setActionError(null);
    try {
      try {
        await api.post('/sessions/reconnect');
      } catch (e: any) {
        if (e?.response?.status === 404) {
          await api.post('/sessions/connect');
        } else {
          throw e;
        }
      }
      startFastPoll();
      queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
      await refetchSession();
    } catch (error: any) {
      setActionError(extractErrorMessage(error, 'Falha ao reconectar'));
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    setActionError(null);
    try {
      await api.post('/sessions/disconnect');
      queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
      await refetchSession();
    } catch (error: any) {
      setActionError(extractErrorMessage(error, 'Falha ao desconectar WhatsApp'));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleReset = async () => {
    setIsResetting(true);
    setActionError(null);
    try {
      await api.post('/whatsapp/reset');
      startFastPoll();
      queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
      queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
      await refetchSession();
    } catch (error: any) {
      setActionError(extractErrorMessage(error, 'Falha ao resetar conexao WhatsApp'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleRefresh = () => {
    setActionError(null);
    queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
    queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
    queryClient.invalidateQueries({ queryKey: ['telegram', 'integration'] });
  };

  const handleTestWhatsAppBot = async () => {
    const result = await testWhatsAppBotMutation.mutateAsync({
      message: botTestMessage.trim(),
      resetContext: botTestResetContext,
    });

    const payload = (result?.data ?? result) as any;
    setBotTestResult({
      input: payload?.input || botTestMessage.trim(),
      response: payload?.response || '',
      lead: payload?.lead || null,
      usedExistingConversation: Boolean(payload?.usedExistingConversation),
      resetContext: Boolean(payload?.resetContext),
    });
  };

  const handleCopyTelegramWebhook = async () => {
    if (!telegramIntegration?.webhookTargetUrl) return;

    try {
      await navigator.clipboard.writeText(telegramIntegration.webhookTargetUrl);
      setTelegramCopyFeedback('Webhook copiado');
    } catch {
      setTelegramCopyFeedback('Nao foi possivel copiar');
    }
  };

  const handleSaveTelegramConfig = async () => {
    await saveTelegramConfigMutation.mutateAsync({
      botToken: telegramBotToken.trim() || undefined,
      webhookSecret: telegramWebhookSecret.trim() || undefined,
    });
    setTelegramBotToken('');
  };

  const handleClearTelegramConfig = async () => {
    await saveTelegramConfigMutation.mutateAsync({ clearToken: true });
    setTelegramBotToken('');
    setTelegramWebhookSecret('');
  };

  const handleTestTelegramConfig = async () => {
    await testTelegramConfigMutation.mutateAsync();
  };

  const handleRegisterTelegramWebhook = async () => {
    await configureTelegramWebhookMutation.mutateAsync('register');
  };

  const handleDeleteTelegramWebhook = async () => {
    await configureTelegramWebhookMutation.mutateAsync('delete');
  };

  const getStatusBadge = () => {
    if (sessionError) {
      return (
        <Badge variant="warning" className="flex items-center gap-xs">
          <AlertCircle className="w-3 h-3" />
          Offline
        </Badge>
      );
    }
    if (isConnected) {
      return (
        <Badge variant="success" className="flex items-center gap-xs">
          <CheckCircle className="w-3 h-3" />
          Conectado
        </Badge>
      );
    }
    if (isLoading) {
      return (
        <Badge variant="warning" className="flex items-center gap-xs">
          <Loader className="w-3 h-3 animate-spin" />
          Conectando
        </Badge>
      );
    }
    if (isScanning) {
      return (
        <Badge variant="brand" className="flex items-center gap-xs">
          <AlertCircle className="w-3 h-3" />
          Escaneie o QR Code
        </Badge>
      );
    }
    return (
      <Badge variant="error" className="flex items-center gap-xs">
        <AlertCircle className="w-3 h-3" />
        Desconectado
      </Badge>
    );
  };

  return (
    <div className="p-lg space-y-lg max-w-4xl">
      <div>
        <h1 className="text-display-md font-display font-bold text-dark-100 flex items-center gap-md">
          <Smartphone className="w-8 h-8 text-brand-500" />
          Conectar Canais
        </h1>
        <p className="text-body-md text-dark-400 mt-xs">
          Conecte e configure seus canais sem sair do painel
        </p>
      </div>

      <Card elevated className="p-lg">
        <CardHeader title="Status do WhatsApp" />
        <CardBody className="mt-md space-y-md">
          <div className="flex items-center justify-between">
            <span className="text-body-md text-dark-300">
              {sessionError ? 'Erro ao buscar status do WhatsApp' : statusLabel(sessionStatus)}
            </span>
            <div className="flex items-center gap-sm">
              {getStatusBadge()}
              <button
                onClick={handleRefresh}
                title="Atualizar status"
                className="p-1 text-dark-400 hover:text-brand-500 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(canConnect || sessionError) && (
            <div className="pt-sm">
              <Button variant="primary" isLoading={isConnecting} onClick={handleConnect}>
                Conectar WhatsApp
              </Button>
            </div>
          )}

          {!sessionError && (
            <div className="pt-sm flex flex-wrap items-center gap-sm">
              {!canConnect && (
                <Button
                  variant="outline"
                  isLoading={isDisconnecting}
                  onClick={() => setShowDisconnectConfirm(true)}
                >
                  Desconectar
                </Button>
              )}
              <Button variant="secondary" isLoading={isReconnecting} onClick={handleReconnect}>
                Reconectar
              </Button>
              <Button variant="ghost" isLoading={isResetting} onClick={() => setShowResetConfirm(true)}>
                Resetar Conexao
              </Button>
            </div>
          )}

          {isStuck && (
            <div className="pt-sm flex items-center gap-md">
              <span className="text-body-sm text-dark-400">
                Parece que esta demorando... Ja escaneou o QR?
              </span>
              <Button variant="secondary" size="sm" isLoading={isReconnecting} onClick={handleReconnect}>
                Forcar Reconexao
              </Button>
            </div>
          )}

          {isConnected && (
            <Alert
              type="success"
              title="Conectado!"
              message="Sua conta do WhatsApp esta ativa. Mensagens recebidas serao processadas automaticamente."
            />
          )}

          {actionError && <Alert type="error" title="Erro ao conectar" message={actionError} />}

          {sessionError && (
            <Alert
              type="warning"
              title="WhatsApp indisponivel"
              message="Nao foi possivel verificar o status do WhatsApp. Verifique se o servico esta em execucao."
            />
          )}
        </CardBody>
      </Card>

      <Card elevated className="p-lg">
        <CardHeader
          title="Testar Bot do WhatsApp"
          subtitle="Simule uma mensagem recebida e veja a resposta do fluxo sem precisar de outro numero"
        />
        <CardBody className="mt-md space-y-md">
          <div className="space-y-sm">
            <label htmlFor="whatsapp-bot-test-message" className="block text-body-sm font-medium text-dark-300">
              Mensagem de teste
            </label>
            <textarea
              id="whatsapp-bot-test-message"
              value={botTestMessage}
              onChange={(e) => setBotTestMessage(e.target.value)}
              rows={4}
              className="input min-h-[120px] resize-y"
              placeholder="Digite a mensagem que o cliente enviaria no WhatsApp"
            />
            <p className="text-body-sm text-dark-400">
              Esse teste usa o mesmo motor do bot, mas nao envia mensagem real para o WhatsApp.
            </p>
          </div>

          <label className="flex items-center gap-sm text-body-sm text-dark-300">
            <input
              type="checkbox"
              checked={botTestResetContext}
              onChange={(e) => setBotTestResetContext(e.target.checked)}
            />
            Comecar do zero neste teste
          </label>

          <div className="flex flex-wrap gap-sm">
            <Button
              variant="primary"
              isLoading={testWhatsAppBotMutation.isPending}
              onClick={handleTestWhatsAppBot}
              disabled={!botTestMessage.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              Testar resposta do bot
            </Button>
          </div>

          {botTestResult && (
            <div className="grid gap-md md:grid-cols-2">
              <div className="p-md rounded-md bg-dark-700/50">
                <p className="text-body-sm text-dark-400">Mensagem simulada</p>
                <p className="text-body-md text-dark-100 mt-xs whitespace-pre-wrap">
                  {botTestResult.input}
                </p>
              </div>
              <div className="p-md rounded-md bg-dark-700/50">
                <p className="text-body-sm text-dark-400">Resposta prevista do bot</p>
                <p className="text-body-md text-dark-100 mt-xs whitespace-pre-wrap">
                  {botTestResult.response || 'O fluxo atual nao gerou texto para essa etapa.'}
                </p>
              </div>
            </div>
          )}

          {botTestResult && (
            <Alert
              type="success"
              title={botTestResult.usedExistingConversation ? 'Teste usando contexto atual' : 'Teste iniciado do zero'}
              message={
                botTestResult.lead
                  ? `O motor tambem montou um lead parcial neste teste.${botTestResult.resetContext ? ' O contexto foi reiniciado antes da simulacao.' : ''}`
                  : botTestResult.resetContext
                    ? 'O contexto foi reiniciado antes da simulacao.'
                    : 'A resposta foi simulada com o contexto atual do tenant quando disponivel.'
              }
            />
          )}
        </CardBody>
      </Card>

      <Card elevated className="p-lg">
        <CardHeader
          title="Configurar Telegram"
          subtitle="Cadastre o bot, valide o token e ative o webhook direto pela interface"
        />
        <CardBody className="mt-md space-y-lg">
          <div className="flex items-center justify-between gap-md flex-wrap">
            <div className="flex items-center gap-sm">
              <Bot className="w-5 h-5 text-brand-500" />
              <div>
                <p className="text-body-md font-medium text-dark-100">
                  {telegramIntegration?.botUsername ? `@${telegramIntegration.botUsername}` : 'Bot ainda nao conectado'}
                </p>
                <p className="text-body-sm text-dark-400">
                  {telegramIntegrationError
                    ? 'Nao foi possivel buscar a integracao do Telegram.'
                    : telegramIntegration?.configured
                      ? 'Token salvo no tenant e pronto para validacao.'
                      : 'Informe o token do bot para comecar a configuracao.'}
                </p>
              </div>
            </div>
            <Badge variant={telegramIntegration?.webhookRegistered ? 'success' : telegramIntegration?.configured ? 'brand' : 'warning'}>
              {telegramIntegration?.webhookRegistered ? 'Webhook ativo' : telegramIntegration?.configured ? 'Bot salvo' : 'Pendente'}
            </Badge>
          </div>

          <div className="grid gap-md md:grid-cols-2">
            <Input
              id="telegram-bot-token"
              name="telegramBotToken"
              label="Token do Bot"
              value={telegramBotToken}
              onChange={(e) => setTelegramBotToken(e.target.value)}
              placeholder={telegramIntegration?.tokenPreview || '123456:ABCDEF...'}
              helperText="Cole o token gerado pelo BotFather. Se ja existir, so preencha para trocar."
            />
            <Input
              id="telegram-webhook-secret"
              name="telegramWebhookSecret"
              label="Secret do Webhook"
              value={telegramWebhookSecret}
              onChange={(e) => setTelegramWebhookSecret(e.target.value)}
              placeholder={telegramIntegration?.webhookSecretConfigured ? 'Ja configurado' : 'Opcional'}
              helperText="Opcional. O FlowDesk envia esse secret para validar chamadas do Telegram."
            />
          </div>

          <div className="grid gap-md md:grid-cols-2">
            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Tenant slug</p>
              <p className="text-body-md font-medium text-dark-100 mt-xs">
                {telegramIntegration?.tenantSlug || 'Nao disponivel'}
              </p>
            </div>

            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Webhook do sistema</p>
              <div className="mt-xs flex items-start gap-sm">
                <p className="text-body-sm text-dark-100 break-all flex-1">
                  {telegramIntegration?.webhookTargetUrl || 'Aguardando dados do tenant'}
                </p>
                <button
                  type="button"
                  onClick={handleCopyTelegramWebhook}
                  disabled={!telegramIntegration?.webhookTargetUrl}
                  className="p-1 text-dark-400 hover:text-brand-500 disabled:opacity-40"
                  title="Copiar webhook"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {telegramCopyFeedback && (
                <p className="text-xs text-brand-400 mt-xs">{telegramCopyFeedback}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-sm">
            <Button
              variant="primary"
              isLoading={saveTelegramConfigMutation.isPending}
              onClick={handleSaveTelegramConfig}
              disabled={!telegramBotToken.trim() && !telegramWebhookSecret.trim()}
            >
              Salvar Bot
            </Button>
            <Button
              variant="secondary"
              isLoading={testTelegramConfigMutation.isPending}
              onClick={handleTestTelegramConfig}
              disabled={!telegramIntegration?.configured}
            >
              Testar Bot
            </Button>
            <Button
              variant="outline"
              isLoading={configureTelegramWebhookMutation.isPending}
              onClick={handleRegisterTelegramWebhook}
              disabled={!telegramIntegration?.configured}
            >
              Ativar Webhook
            </Button>
            <Button
              variant="ghost"
              isLoading={configureTelegramWebhookMutation.isPending}
              onClick={handleDeleteTelegramWebhook}
              disabled={!telegramIntegration?.configured}
            >
              Remover Webhook
            </Button>
            <Button
              variant="ghost"
              isLoading={saveTelegramConfigMutation.isPending}
              onClick={handleClearTelegramConfig}
              disabled={!telegramIntegration?.configured}
            >
              Limpar Bot
            </Button>
          </div>

          {telegramIntegration?.configured && (
            <Alert
              type={telegramIntegration.webhookRegistered ? 'success' : 'warning'}
              title={telegramIntegration.webhookRegistered ? 'Telegram ativo no FlowDesk' : 'Bot salvo, falta ativar o webhook'}
              message={
                telegramIntegration.webhookRegistered
                  ? `O webhook atual aponta para ${telegramIntegration.webhookConfiguredUrl || telegramIntegration.webhookTargetUrl}.`
                  : 'Clique em "Ativar Webhook" para o FlowDesk registrar automaticamente o webhook do bot no Telegram.'
              }
            />
          )}

          {telegramIntegration?.lastError && (
            <Alert
              type="error"
              title="Ultimo erro do Telegram"
              message={telegramIntegration.lastError}
            />
          )}

          {telegramIntegration?.webhookInfo?.last_error_message && (
            <Alert
              type="warning"
              title="Erro reportado pelo Telegram"
              message={telegramIntegration.webhookInfo.last_error_message}
            />
          )}

          <div className="grid gap-md md:grid-cols-3">
            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Bot atual</p>
              <p className="text-body-md font-medium text-dark-100 mt-xs">
                {telegramIntegration?.botUsername ? `@${telegramIntegration.botUsername}` : 'Nao identificado'}
              </p>
            </div>
            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Mensagens pendentes</p>
              <p className="text-body-md font-medium text-dark-100 mt-xs">
                {telegramIntegration?.webhookInfo?.pending_update_count ?? 0}
              </p>
            </div>
            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Secret configurado</p>
              <p className="text-body-md font-medium text-dark-100 mt-xs">
                {telegramIntegration?.webhookSecretConfigured ? 'Sim' : 'Nao'}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {(isScanning || Boolean(qrImage) || Boolean(qrText) || isLoading) && (
        <Card elevated className="p-lg">
          <CardHeader
            title="Escaneie o QR Code"
            subtitle="Abra o WhatsApp > Menu (...) > Aparelhos conectados > Conectar aparelho"
          />
          <CardBody className="mt-md flex justify-center py-lg">
            {qrImage ? (
              <div className="bg-white p-md rounded-lg shadow-sm">
                <img
                  src={qrImage}
                  alt="QR Code WhatsApp"
                  width={256}
                  height={256}
                  style={{ imageRendering: 'pixelated' }}
                />
              </div>
            ) : qrText ? (
              <div className="bg-white p-md rounded-lg shadow-sm">
                <QRCode value={qrText} size={256} level="M" includeMargin renderAs="svg" />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-md text-dark-400">
                <Loader className="w-8 h-8 animate-spin text-brand-500" />
                <span className="text-body-sm">Gerando QR code...</span>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="Desconectar WhatsApp?"
        description="A sessao WhatsApp sera parada e o vinculo atual sera limpo. Leads, mensagens, metricas, usuarios e plano nao serao apagados."
        confirmText="Desconectar"
        cancelText="Cancelar"
        isDangerous
        isLoading={isDisconnecting}
        onCancel={() => setShowDisconnectConfirm(false)}
        onConfirm={async () => {
          setShowDisconnectConfirm(false);
          await handleDisconnect();
        }}
      />

      <ConfirmDialog
        isOpen={showResetConfirm}
        title="Resetar conexao WhatsApp?"
        description="A sessao atual sera encerrada, o vinculo sera limpo e uma nova sessao exclusiva sera criada. Um novo QR Code sera exigido. Nenhum dado de negocio sera removido."
        confirmText="Resetar e gerar novo QR"
        cancelText="Cancelar"
        isDangerous
        isLoading={isResetting}
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={async () => {
          setShowResetConfirm(false);
          await handleReset();
        }}
      />
    </div>
  );
}
