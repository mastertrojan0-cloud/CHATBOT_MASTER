import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { Smartphone, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { Card, CardHeader, CardBody, Alert, Badge } from '@/components';
import { useWAHASession, useWAHAQR, useWAHAStatus } from '@/hooks/queries';
import { apiClient } from '@/config/api';
import { Tenant } from '@/types';

export default function ConnectPage() {
  const { data: wahaSession, isLoading } = useWAHASession();
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  useEffect(() => {
    if (!wahaSession) return;

    const status = wahaSession.status;

    if (status === 'STOPPED' || status === 'DISCONNECTED') {
      setStatusMessage('WhatsApp desconectado');
    } else if (status === 'WORKING' || status === 'CONNECTED') {
      setStatusMessage('WhatsApp conectado com sucesso!');
    } else if (status === 'STARTING' || status === 'CONNECTING') {
      setStatusMessage('Conectando ao WhatsApp...');
    } else if (status === 'SCAN_QR_CODE') {
      setStatusMessage('Escaneie o QR code com sua câmera do WhatsApp');
      apiClient.getWAHAQR().then((res) => {
        if (res.success && res.data?.value) {
          setQrValue(res.data.value);
        }
      }).catch(console.error);
    } else {
      setStatusMessage('Status desconhecido');
    }
  }, [wahaSession]);

  const getStatusBadge = () => {
    const status = wahaSession?.status;
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
        </CardBody>
      </Card>

      {/* QR Code Card */}
      {wahaSession?.status === 'SCAN_QR_CODE' && qrValue && (
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
      {wahaStatus?.state === 'CONNECTED' && (
        <Alert
          type="success"
          title="Conectado com sucesso!"
          message="Sua conta do WhatsApp está conectada. Você pode começar a gerenciar seus leads."
        />
      )}

      {wahaStatus?.state === 'DISCONNECTED' && (
        <Alert
          type="error"
          title="Desconectado"
          message="Sua conexão com o WhatsApp foi perdida. Escaneie o QR Code novamente para reconectar."
        />
      )}
    </div>
  );
}
