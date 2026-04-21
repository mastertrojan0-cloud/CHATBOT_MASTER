import React, { useEffect, useRef, useState } from 'react';
import { Smartphone, CheckCircle, AlertCircle, Loader, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardBody, Alert, Badge, Button } from '@/components';
import { useWAHASession, useWAHAQR } from '@/hooks/queries';
import api from '@/config/api';
import { useQueryClient } from '@tanstack/react-query';

// Real WAHA statuses: STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
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
  const [actionError, setActionError] = useState<string | null>(null);
  const fastPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stuckTimer, setStuckTimer] = useState(0);

  const {
    data: sessionData,
    isError: sessionError,
    refetch: refetchSession,
  } = useWAHASession();

  const sessionStatus = sessionData?.status || '';
  const isScanning = sessionStatus === SCANNING_STATUS;
  const isConnected = CONNECTED_STATUSES.includes(sessionStatus);
  const isLoading = LOADING_STATUSES.includes(sessionStatus);
  const canConnect = INACTIVE_STATUSES.includes(sessionStatus);
  const isStuck = STUCK_STATUSES.includes(sessionStatus) && stuckTimer > 20;

  const { data: qrImageData } = useWAHAQR(isScanning);
  const qrImage = qrImageData?.value || null;

  // Fast-poll for 15 seconds after initiating connect to catch quick transitions
  // Fast-poll: every 500ms. Duration: 180 iterations = 90 seconds
  // This covers the entire QR validity window (60s first QR + 6x20s subsequent)
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

  // Auto-start fast-poll as soon as QR is displayed (status = SCAN_QR_CODE)
  // This ensures we catch WORKING immediately after the user scans
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

  // Track how long we've been in a transitional state
  useEffect(() => {
    if (STUCK_STATUSES.includes(sessionStatus)) {
      const t = setInterval(() => setStuckTimer(n => n + 1), 1000);
      return () => clearInterval(t);
    } else {
      setStuckTimer(0);
    }
  }, [sessionStatus]);

  useEffect(() => {
    return () => {
      if (fastPollRef.current) clearInterval(fastPollRef.current);
    };
  }, []);

  function extractErrorMessage(error: any, fallback: string): string {
    const data = error?.response?.data;
    if (!data) return error?.message || fallback;
    // API may return { error: string } or { error: { message: string } }
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
      // Try /reconnect first; fall back to /connect if route not yet deployed
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

  const handleRefresh = () => {
    setActionError(null);
    queryClient.invalidateQueries({ queryKey: ['waha', 'session'] });
    queryClient.invalidateQueries({ queryKey: ['waha', 'qr'] });
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
      {/* Header */}
      <div>
        <h1 className="text-display-md font-display font-bold text-dark-100 flex items-center gap-md">
          <Smartphone className="w-8 h-8 text-brand-500" />
          Conectar WhatsApp
        </h1>
        <p className="text-body-md text-dark-400 mt-xs">
          Conecte sua conta do WhatsApp para começar a gerenciar leads
        </p>
      </div>

      {/* Status Card */}
      <Card elevated className="p-lg">
        <CardHeader title="Status da Conexão" />
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
              <Button
                variant="primary"
                isLoading={isConnecting}
                onClick={handleConnect}
              >
                Conectar WhatsApp
              </Button>
            </div>
          )}

          {isStuck && (
            <div className="pt-sm flex items-center gap-md">
              <span className="text-body-sm text-dark-400">
                Parece que está demorando... Já escaneou o QR?
              </span>
              <Button
                variant="secondary"
                size="sm"
                isLoading={isReconnecting}
                onClick={handleReconnect}
              >
                Forçar Reconexão
              </Button>
            </div>
          )}

          {isConnected && (
            <Alert
              type="success"
              title="Conectado!"
              message="Sua conta do WhatsApp está ativa. Mensagens recebidas serão processadas automaticamente."
            />
          )}

          {actionError && (
            <Alert
              type="error"
              title="Erro ao conectar"
              message={actionError}
            />
          )}

          {sessionError && (
            <Alert
              type="warning"
              title="WhatsApp indisponível"
              message="Não foi possível verificar o status do WhatsApp. Verifique se o serviço está em execução."
            />
          )}
        </CardBody>
      </Card>

      {/* QR Code Card */}
      {isScanning && (
        <Card elevated className="p-lg">
          <CardHeader
            title="Escaneie o QR Code"
            subtitle="Abra o WhatsApp → Menu (⋮) → Aparelhos conectados → Conectar aparelho"
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
            ) : (
              <div className="flex flex-col items-center gap-md text-dark-400">
                <Loader className="w-8 h-8 animate-spin text-brand-500" />
                <span className="text-body-sm">Gerando QR code...</span>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Steps Card */}
      <Card elevated className="p-lg">
        <CardHeader
          title="Passos para Conectar"
          subtitle="Siga estas instruções para conectar sua conta"
        />
        <CardBody className="mt-md space-y-md">
          <div className="space-y-md">
            {[
              { label: 'Clique em "Conectar WhatsApp"', desc: 'Aguarde o QR code aparecer na tela' },
              { label: 'Abra o WhatsApp no seu celular', desc: 'Acesse Menu (⋮) → Aparelhos conectados → Conectar aparelho' },
              { label: 'Escaneie o QR Code', desc: 'Aponte a câmera do WhatsApp para o código exibido' },
              { label: 'Pronto!', desc: 'Aguarde alguns segundos — o status atualizará automaticamente' },
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
    </div>
  );
}
