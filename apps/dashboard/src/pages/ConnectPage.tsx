import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { Smartphone, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Card, CardHeader, CardBody, Alert, Badge } from '@/components';
import { useWAHASession, useWAHAStatus } from '@/hooks/queries';
import api from '@/config/api';

export default function ConnectPage() {
  const [isWAHAOffline, setIsWAHAOffline] = useState(false);
  const { data: wahaSession, isError: sessionError } = useWAHASession(!isWAHAOffline);
  const { data: wahaStatus, isError: statusError } = useWAHAStatus(!isWAHAOffline);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const sessionData = (wahaSession as any)?.data || wahaSession || {};
  const statusData = (wahaStatus as any)?.data || wahaStatus || {};
  const sessionStatus = typeof sessionData?.status === 'string' ? sessionData.status : '';
  const statusState = typeof statusData?.state === 'string' ? statusData.state : '';

  useEffect(() => {
    if (sessionError || statusError) {
      setIsWAHAOffline(true);
      setQrValue(null);
      setStatusMessage('WhatsApp ainda nao configurado. Entre em contato com o suporte para ativar.');
    }
  }, [sessionError, statusError]);

  useEffect(() => {
    if (isWAHAOffline) {
      return;
    }

    if (!sessionStatus) {
      setStatusMessage('Carregando status da conexão...');
      return;
    }

    const status = sessionStatus;

    if (status === 'STOPPED' || status === 'DISCONNECTED') {
      setStatusMessage('WhatsApp desconectado');
    } else if (status === 'WORKING' || status === 'CONNECTED') {
      setStatusMessage('WhatsApp conectado com sucesso!');
    } else if (status === 'STARTING' || status === 'CONNECTING') {
      setStatusMessage('Conectando ao WhatsApp...');
    } else if (status === 'SCAN_QR_CODE') {
      setStatusMessage('Escaneie o QR code com sua câmera do WhatsApp');
      api.get('/sessions/qr').then((res) => {
        if (res.success && res.data?.value) {
          setQrValue(res.data.value);
        } else {
          setQrValue(null);
        }
      }).catch(() => {
        setQrValue(null);
      });
    } else {
      setStatusMessage('Status desconhecido');
    }
  }, [sessionStatus, isWAHAOffline]);

  const getStatusBadge = () => {
    if (isWAHAOffline) {
      return (
        <Badge variant="warning" className="flex items-center gap-xs">
          <AlertCircle className="w-3 h-3" />
          Offline
        </Badge>
      );
    }

    const status = sessionStatus;
    switch (status) {
      case 'WORKING':
      case 'CONNECTED':
        return (
          <Badge variant="success" className="flex items-center gap-xs">
            <CheckCircle className="w-3 h-3" />
            Conectado
          </Badge>
        );
      case 'STARTING':
      case 'CONNECTING':
        return (
          <Badge variant="warning" className="flex items-center gap-xs">
            <Loader className="w-3 h-3 animate-spin" />
            Conectando
          </Badge>
        );
      case 'SCAN_QR_CODE':
        return (
          <Badge variant="brand" className="flex items-center gap-xs">
            <AlertCircle className="w-3 h-3" />
            Escaneie o QR Code
          </Badge>
        );
      default:
        return (
          <Badge variant="error" className="flex items-center gap-xs">
            <AlertCircle className="w-3 h-3" />
            Desconectado
          </Badge>
        );
    }
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
            <span className="text-body-md text-dark-300">{statusMessage}</span>
            {getStatusBadge()}
          </div>

          {isWAHAOffline && (
            <Alert
              type="warning"
              title="WhatsApp indisponível"
              message="WhatsApp ainda nao configurado. Entre em contato com o suporte para ativar."
            />
          )}
        </CardBody>
      </Card>

      {/* QR Code Card */}
      {!isWAHAOffline && sessionStatus === 'SCAN_QR_CODE' && qrValue && (
        <Card elevated className="p-lg">
          <CardHeader title="Escaneie o QR Code" subtitle="Use seu telefone com WhatsApp aberto" />
          <CardBody className="mt-md flex justify-center py-lg">
            <div className="bg-white p-md rounded-lg">
              <QRCode
                value={qrValue}
                size={256}
                level="H"
                includeMargin={true}
              />
            </div>
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
            <div className="flex gap-md">
              <div className="flex-shrink-0 w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
                <span className="text-brand-400 font-semibold text-sm">1</span>
              </div>
              <div>
                <h4 className="text-body-md font-medium text-dark-100">
                  Abra o WhatsApp no seu telefone
                </h4>
                <p className="text-body-sm text-dark-400 mt-xs">
                  Acesse o aplicativo do WhatsApp em seu telefone
                </p>
              </div>
            </div>

            <div className="flex gap-md">
              <div className="flex-shrink-0 w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
                <span className="text-brand-400 font-semibold text-sm">2</span>
              </div>
              <div>
                <h4 className="text-body-md font-medium text-dark-100">
                  Escaneie o QR Code
                </h4>
                <p className="text-body-sm text-dark-400 mt-xs">
                  Use a câmera do seu WhatsApp para escanear o código ao lado
                </p>
              </div>
            </div>

            <div className="flex gap-md">
              <div className="flex-shrink-0 w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
                <span className="text-brand-400 font-semibold text-sm">3</span>
              </div>
              <div>
                <h4 className="text-body-md font-medium text-dark-100">
                  Aprove a conexão
                </h4>
                <p className="text-body-sm text-dark-400 mt-xs">
                  Confirme a conexão quando solicitado
                </p>
              </div>
            </div>

            <div className="flex gap-md">
              <div className="flex-shrink-0 w-8 h-8 bg-brand-500/20 rounded-full flex items-center justify-center">
                <span className="text-brand-400 font-semibold text-sm">4</span>
              </div>
              <div>
                <h4 className="text-body-md font-medium text-dark-100">
                  Pronto!
                </h4>
                <p className="text-body-sm text-dark-400 mt-xs">
                  Sua conta será conectada e você poderá começar a gerenciar leads
                </p>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Info Card */}
      {!isWAHAOffline && statusState === 'CONNECTED' && (
        <Alert
          type="success"
          title="Conectado com sucesso!"
          message="Sua conta do WhatsApp está conectada. Você pode começar a gerenciar seus leads."
        />
      )}

      {!isWAHAOffline && statusState === 'DISCONNECTED' && (
        <Alert
          type="error"
          title="Desconectado"
          message="Sua conexão com o WhatsApp foi perdida. Escaneie o QR Code novamente para reconectar."
        />
      )}
    </div>
  );
}
