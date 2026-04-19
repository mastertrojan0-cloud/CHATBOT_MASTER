import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAuth, authenticatedLimiter } from '../middleware';
import { wahaService } from '../services/waha.service';
import { prisma } from '@flowdesk/db';

const router = Router();

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
          data: { status: 'STOPPED' },
        });
        return;
      }

      const wahaSession = await wahaService.getSession(tenant.wahaSessionName);

      if (!wahaSession.session) {
        res.json({
          success: true,
          data: { status: 'STOPPED' },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          status: wahaSession.session.status,
          phoneNumber: wahaSession.session.phone,
          sessionName: wahaSession.session.name,
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
        select: { slug: true, wahaSessionName: true },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      const sessionName = tenant.wahaSessionName || `flowdesk_${tenant.slug}`;

      if (!tenant.wahaSessionName) {
        try {
          await wahaService.createSession(sessionName);
        } catch (error: any) {
          if (!error.response?.status || error.response.status !== 409) {
            throw error;
          }
        }
      }

      try {
        await wahaService.startSession(sessionName);
      } catch (error: any) {
        console.log('Start session error:', error.response?.data || error.message);
      }

      const webhookBaseUrl = process.env.WAHA_WEBHOOK_BASE_URL 
        || process.env.RAILWAY_STATIC_URL 
        || process.env.APP_URL 
        || 'http://localhost:3333';
      
      await wahaService.setWebhook(
        sessionName, 
        `${webhookBaseUrl}/api/webhooks/waha/${sessionName}`
      );

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

      if (!tenant?.wahaSessionName) {
        res.status(404).json({
          success: false,
          error: 'QR não disponível. Conecte primeiro.',
        });
        return;
      }

      const qrResult = await wahaService.getQrCode(tenant.wahaSessionName);

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
        try {
          await wahaService.stopSession(tenant.wahaSessionName);
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
          data: { connected: false },
        });
        return;
      }

      const wahaSession = await wahaService.getSession(tenant.wahaSessionName);

      res.json({
        success: true,
        data: {
          connected: !!wahaSession.session,
          phoneNumber: wahaSession.session?.phone,
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
