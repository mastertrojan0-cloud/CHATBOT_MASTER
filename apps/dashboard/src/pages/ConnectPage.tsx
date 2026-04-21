import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Loader, RefreshCw, Send, Copy } from 'lucide-react';
import QRCode from 'qrcode.react';
import { Card, CardHeader, CardBody, Alert, Badge, Button, ConfirmDialog } from '@/components';
import { useWAHASession, useWAHAQR, useTelegramHealth, useTenant } from '@/hooks/queries';
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
  if (status === 'STARTING') return 'Iniciando conexão com WhatsApp...';
  if (status === 'STOPPED') return 'WhatsApp desconectado';
  if (status === 'FAILED') return 'Falha na conexão. Clique em Conectar para tentar novamente.';
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
  const [telegramCopyFeedback, setTelegramCopyFeedback] = useState<string | null>(null);
  const fastPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stuckTimer, setStuckTimer] = useState(0);

  const {
    data: sessionData,
    isError: sessionError,
    refetch: refetchSession,
  } = useWAHASession();
  const { data: qrImageData } = useWAHAQR(sessionData?.status === SCANNING_STATUS);
  const { data: tenantData } = useTenant();
  const { data: telegramHealth, isError: telegramHealthError } = useTelegramHealth();

  const sessionStatus = sessionData?.status || '';
  const isScanning = sessionStatus === SCANNING_STATUS;
  const isConnected = CONNECTED_STATUSES.includes(sessionStatus);
  const isLoading = LOADING_STATUSES.includes(sessionStatus);
  const canConnect = INACTIVE_STATUSES.includes(sessionStatus);
  const isStuck = STUCK_STATUSES.includes(sessionStatus) && stuckTimer > 20;

  const qrImage = qrImageData?.kind === 'image' ? qrImageData.value : null;
  const qrText = qrImageData?.kind === 'text' ? qrImageData.value : null;
  const tenantInfo = (tenantData as any)?.data || tenantData || {};
  const tenantSlug = typeof tenantInfo?.slug === 'string' ? tenantInfo.slug : '';

  const telegramWebhookUrl = useMemo(() => {
    if (!tenantSlug) return '';

    const apiBase = (import.meta.env.VITE_API_URL as string | undefined) || '/api';
    const normalizedBase = apiBase.startsWith('http')
      ? apiBase.replace(/\/+$/, '')
      : `${window.location.origin}${apiBase.startsWith('/') ? apiBase : `/${apiBase}`}`.replace(/\/+$/, '');

    return `${normalizedBase}/webhooks/telegram/${tenantSlug}`;
  }, [tenantSlug]);

  useEffect(() => {
    return () => {
      if (qrImage?.startsWith('blob:')) {
        URL.revokeObjectURL(qrImage);
      }
    };
  }, [qrImage]);

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
      await refetchSession();
    } catch (error: any) {
      setActionError(extractErrorMessage(error, 'Falha ao iniciar conexão com WhatsApp'));
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
      setActionError(extractErrorMessage(error, 'Falha ao resetar conexão WhatsApp'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleRefresh = () => {
    setActionError(null);
    queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
    queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
    queryClient.invalidateQueries({ queryKey: ['telegram', 'health'] });
  };

  const handleCopyTelegramWebhook = async () => {
    if (!telegramWebhookUrl) return;

    try {
      await navigator.clipboard.writeText(telegramWebhookUrl);
      setTelegramCopyFeedback('Webhook copiado');
    } catch {
      setTelegramCopyFeedback('Nao foi possivel copiar');
    }
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
    <div className="p-lg space-y-lg max-w-2xl">
      <div>
        <h1 className="text-display-md font-display font-bold text-dark-100 flex items-center gap-md">
          <Smartphone className="w-8 h-8 text-brand-500" />
          Conectar Canais
        </h1>
        <p className="text-body-md text-dark-400 mt-xs">
          Conecte seus canais para começar a gerenciar leads no sistema
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
          title="Canal Telegram"
          subtitle="Ative um bot do Telegram usando o mesmo fluxo de atendimento do sistema"
        />
        <CardBody className="mt-md space-y-md">
          <div className="flex items-center justify-between gap-md">
            <div>
              <h3 className="text-body-md font-medium text-dark-100 flex items-center gap-sm">
                <Send className="w-4 h-4 text-brand-500" />
                Status do bot
              </h3>
              <p className="text-body-sm text-dark-400 mt-xs">
                {telegramHealthError
                  ? 'Nao foi possivel verificar o Telegram agora.'
                  : telegramHealth?.configured
                    ? 'Token do bot detectado no backend.'
                    : 'Configure o token do bot para habilitar o canal Telegram.'}
              </p>
            </div>
            <Badge variant={telegramHealth?.configured ? 'success' : 'warning'}>
              {telegramHealth?.configured ? 'Configurado' : 'Pendente'}
            </Badge>
          </div>

          <div className="grid gap-md md:grid-cols-2">
            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Tenant slug</p>
              <p className="text-body-md font-medium text-dark-100 mt-xs">
                {tenantSlug || 'Slug ainda nao disponivel'}
              </p>
            </div>

            <div className="p-md rounded-md bg-dark-700/50">
              <p className="text-body-sm text-dark-400">Webhook do sistema</p>
              <div className="mt-xs flex items-start gap-sm">
                <p className="text-body-sm text-dark-100 break-all flex-1">
                  {telegramWebhookUrl || 'A URL aparece aqui quando o tenant tiver slug'}
                </p>
                <button
                  type="button"
                  onClick={handleCopyTelegramWebhook}
                  disabled={!telegramWebhookUrl}
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

          <Alert
            type={telegramHealth?.configured ? 'success' : 'warning'}
            title={telegramHealth?.configured ? 'Backend pronto para Telegram' : 'Falta configurar o bot'}
            message={
              telegramHealth?.configured
                ? 'Crie ou atualize o webhook do seu bot apontando para a URL acima. O sistema vai receber a mensagem, rodar o fluxo e responder pelo Telegram.'
                : 'Defina TELEGRAM_BOT_TOKEN no backend e depois registre o webhook do bot para esta URL.'
            }
          />

          <div className="space-y-sm">
            <p className="text-body-sm font-medium text-dark-100">Como ativar</p>
            <div className="space-y-sm text-body-sm text-dark-300">
              <p>1. Crie o bot no BotFather e pegue o token.</p>
              <p>2. Configure TELEGRAM_BOT_TOKEN no backend do sistema.</p>
              <p>3. Registre o webhook do bot usando a URL exibida acima.</p>
              <p>4. Se quiser, envie tambem o secret_token igual ao TELEGRAM_WEBHOOK_SECRET.</p>
            </div>
          </div>
        </CardBody>
      </Card>

      {isScanning && (
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

      <Card elevated className="p-lg">
        <CardHeader title="Passos para Conectar" subtitle="Siga estas instrucoes para conectar sua conta" />
        <CardBody className="mt-md space-y-md">
          <div className="space-y-md">
            {[
              { label: 'Clique em "Conectar WhatsApp"', desc: 'Aguarde o QR code aparecer na tela' },
              { label: 'Abra o WhatsApp no seu celular', desc: 'Acesse Menu (...) > Aparelhos conectados > Conectar aparelho' },
              { label: 'Escaneie o QR Code', desc: 'Aponte a camera do WhatsApp para o codigo exibido' },
              { label: 'Pronto!', desc: 'Aguarde alguns segundos e o status atualizara automaticamente' },
            ].map((step, i) => (
              <div key={i} className="flex gap-md">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
                  <span className="text-brand-400 font-semibold text-sm">{i + 1}</span>
                </div>
                <div>
                  <h4 className="text-body-md font-medium text-dark-100">{step.label}</h4>
                  <p className="text-body-sm text-dark-400 mt-xs">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

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
