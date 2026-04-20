import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAuth, authenticatedLimiter } from '../middleware';
import { wahaService } from '../services/waha.service';
import { prisma } from '@flowdesk/db';

const router = Router();
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'default';

function getSessionNameFromTenant(tenantSessionName?: string | null): string {
  if (!tenantSessionName || tenantSessionName.trim() === '') {
    return WAHA_SESSION_NAME;
  }

  // WAHA CORE suporta apenas a sessão "default".
  return WAHA_SESSION_NAME;
}

/**
 * GET /api/sessions/current
 * Obter status da sessão WhatsApp atual
 */
router.get(
  '/current',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { wahaSessionName: true },
      });

      if (!tenant?.wahaSessionName) {
        res.json({
          success: true,
          data: { status: 'STOPPED', sessionName: WAHA_SESSION_NAME },
        });
        return;
      }

      const sessionName = getSessionNameFromTenant(tenant.wahaSessionName);
      const wahaSession = await wahaService.getSession(sessionName);

      if (!wahaSession.session) {
        res.json({
          success: true,
          data: { status: 'STOPPED', sessionName },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          status: wahaSession.session.status,
          phoneNumber: wahaSession.session.phone,
          sessionName,
        },
      });
    } catch (error: any) {
      console.error('Error fetching session:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao buscar sessão',
      });
    }
  }
);

/**
 * POST /api/sessions/connect
 * Iniciar conexão com WhatsApp (obtém QR code)
 */
router.post(
  '/connect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { wahaSessionName: true },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      const sessionName = getSessionNameFromTenant(tenant.wahaSessionName);

      // Check if session exists, create if not
      const existingSession = await wahaService.getSession(sessionName);

      if (!existingSession.session) {
        try {
          await wahaService.createSession(sessionName);
        } catch (error: any) {
          // Session may already exist, continue
          console.log('Create session:', error.response?.data?.message || 'created');
        }
      }

      try {
        await wahaService.startSession(sessionName);
      } catch (error: any) {
        console.log('Start session:', error.response?.data?.message || error.message);
      }

      // Set webhook (optional, don't fail if WAHA doesn't support it)
      const webhookBaseUrl = process.env.WAHA_WEBHOOK_BASE_URL
        || process.env.RAILWAY_STATIC_URL
        || process.env.APP_URL
        || 'http://localhost:3333';

      try {
        await wahaService.setWebhook(
          sessionName,
          `${webhookBaseUrl}/api/webhooks/waha/${sessionName}`
        );
      } catch (error: any) {
        console.log('Set webhook:', error.response?.data?.message || 'skipped');
      }

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: { wahaSessionName: sessionName },
      });

      res.json({
        success: true,
        data: { sessionName, status: 'STARTING' },
      });
    } catch (error: any) {
      console.error('Error connecting session:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao conectar sessão',
      });
    }
  }
);

/**
 * GET /api/sessions/qr
 * Obter QR code (para polling)
 */
router.get(
  '/qr',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { wahaSessionName: true },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      const sessionName = getSessionNameFromTenant(tenant.wahaSessionName);

      if (!tenant?.wahaSessionName) {
        res.status(404).json({
          success: false,
          error: 'QR não disponível. Conecte primeiro.',
        });
        return;
      }

      const qrResult = await wahaService.getQrCode(sessionName);

      if (!qrResult.qr) {
        res.status(404).json({
          success: false,
          error: 'QR não disponível. Aguarde ou reconecte.',
        });
        return;
      }

      res.json({
        success: true,
        data: {
          value: qrResult.qr.code,
          mime: 'image/png',
          expiresAt: qrResult.qr.expiresAt,
        },
      });
    } catch (error: any) {
      console.error('Error fetching QR:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao buscar QR code',
      });
    }
  }
);

/**
 * POST /api/sessions/disconnect
 * Desconectar da sessão WhatsApp
 */
router.post(
  '/disconnect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { wahaSessionName: true },
      });

      if (tenant?.wahaSessionName) {
        const sessionName = getSessionNameFromTenant(tenant.wahaSessionName);
        try {
          await wahaService.stopSession(sessionName);
        } catch (error: any) {
          console.log('Stop session error:', error.response?.data || error.message);
        }
      }

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: { wahaSessionName: '' },
      });

      res.json({
        success: true,
        data: { ok: true },
      });
    } catch (error: any) {
      console.error('Error disconnecting session:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao desconectar sessão',
      });
    }
  }
);

/**
 * GET /api/sessions/status
 * Obter status da sessão (para health checks)
 */
router.get(
  '/status',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { wahaSessionName: true },
      });

      if (!tenant?.wahaSessionName) {
        res.json({
          success: true,
          data: { connected: false, state: 'DISCONNECTED', sessionName: WAHA_SESSION_NAME },
        });
        return;
      }

      const sessionName = getSessionNameFromTenant(tenant.wahaSessionName);
      const wahaSession = await wahaService.getSession(sessionName);
      const rawStatus = wahaSession.session?.status || 'STOPPED';
      const connected = rawStatus === 'WORKING' || rawStatus === 'CONNECTED';

      res.json({
        success: true,
        data: {
          connected,
          state: connected ? 'CONNECTED' : 'DISCONNECTED',
          phoneNumber: wahaSession.session?.phone,
          sessionName,
          status: rawStatus,
          lastCheckedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error checking session status:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao verificar status',
      });
    }
  }
);

export default router;
