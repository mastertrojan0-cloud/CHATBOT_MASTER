import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAuth, authenticatedLimiter } from '../middleware';
import { wahaService } from '../services/waha.service';
import { prisma } from '@flowdesk/db';

const router = Router();
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'default';

// Real WAHA statuses that mean "do not restart"
// Docs: STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
const DO_NOT_RESTART = ['WORKING', 'SCAN_QR_CODE', 'STARTING'];

function getFirstValidBaseUrl(...candidates: Array<string | undefined>): string {
  const invalidValues = new Set(['', 'placeholder', 'http://placeholder', 'https://placeholder']);

  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || invalidValues.has(value.toLowerCase())) {
      continue;
    }

    if (/^https?:\/\//i.test(value)) {
      return value.replace(/\/$/, '');
    }
  }

  const port = process.env.PORT || '3333';
  return `http://localhost:${port}`;
}

async function getSessionName(req: AuthRequest): Promise<string> {
  const tenantId = req.tenantId;

  if (!tenantId) {
    return WAHA_SESSION_NAME;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { wahaSessionName: true },
  });

  if (tenant?.wahaSessionName) {
    return tenant.wahaSessionName;
  }

  return `tenant-${tenantId}`;
}

/**
 * GET /api/sessions/current
 */
router.get(
  '/current',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || 'STOPPED';
      console.log(`[sessions/current] status="${status}" me=${JSON.stringify((session as any)?.me)}`);
      res.json({
        success: true,
        data: {
          status,
          phoneNumber: (session as any)?.me?.id || null,
          sessionName,
        },
      });
    } catch (error: any) {
      console.error('[sessions/current]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao buscar sessao' });
    }
  }
);

/**
 * POST /api/sessions/connect
 *
 * WAHA session lifecycle (from docs):
 *   STOPPED -> start -> STARTING -> SCAN_QR_CODE -> (scan) -> WORKING
 *   FAILED  -> restart -> STARTING -> SCAN_QR_CODE -> (scan) -> WORKING
 *
 * Rules:
 *   - WORKING / SCAN_QR_CODE / STARTING -> do nothing
 *   - FAILED -> use /restart
 *   - STOPPED (exists) -> PUT config then /start
 *   - Not found -> POST /sessions
 */
router.post(
  '/connect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const webhookBaseUrl = getFirstValidBaseUrl(
        process.env.WAHA_WEBHOOK_BASE_URL,
        process.env.RAILWAY_STATIC_URL,
        process.env.APP_URL
      );
      const webhookUrl = `${webhookBaseUrl}/api/webhooks/waha/${sessionName}`;

      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || '';
      console.log(`[sessions/connect] current status="${status}"`);

      if (DO_NOT_RESTART.includes(status)) {
        console.log(`[sessions/connect] session is ${status} - not restarting`);
        res.json({ success: true, data: { sessionName, status } });
        return;
      }

      if (status === 'FAILED') {
        console.log('[sessions/connect] FAILED -> restarting');
        try {
          await wahaService.restartSession(sessionName);
        } catch (e: any) {
          console.error('[sessions/connect] restart error:', e.response?.data || e.message);
          throw e;
        }

        await prisma.tenant.update({ where: { id: req.tenantId }, data: { wahaSessionName: sessionName } });
        const { session: restartedSession } = await wahaService.getSession(sessionName);
        res.json({ success: true, data: { sessionName, status: restartedSession?.status || 'STARTING' } });
        return;
      }

      if (!session) {
        console.log(`[sessions/connect] creating session "${sessionName}"`);
        try {
          await wahaService.createSession(sessionName, webhookUrl);
        } catch (e: any) {
          console.log('[sessions/connect] create:', e.response?.data?.message || e.message);
          if (e.response?.status === 409) {
            await wahaService.startSession(sessionName);
          } else {
            throw e;
          }
        }
      } else {
        console.log('[sessions/connect] STOPPED -> updating config and starting');
        try {
          await wahaService.updateSessionConfig(sessionName, webhookUrl);
        } catch (e: any) {
          console.log('[sessions/connect] updateConfig:', e.response?.data || e.message);
        }

        try {
          await wahaService.startSession(sessionName);
        } catch (e: any) {
          console.log('[sessions/connect] start:', e.response?.data || e.message);
          throw e;
        }
      }

      await prisma.tenant.update({ where: { id: req.tenantId }, data: { wahaSessionName: sessionName } });
      const { session: updatedSession } = await wahaService.getSession(sessionName);
      res.json({ success: true, data: { sessionName, status: updatedSession?.status || 'STARTING' } });
    } catch (error: any) {
      console.error('[sessions/connect]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao conectar sessao' });
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
      const sessionName = await getSessionName(req);
      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || 'STOPPED';

      if (status !== 'SCAN_QR_CODE') {
        res.status(409).json({
          success: false,
          error: `QR indisponivel no estado atual: ${status}`,
        });
        return;
      }

      const qrResult = await wahaService.getQrCode(sessionName);

      if (!qrResult.qr) {
        res.status(404).json({
          success: false,
          error: `QR nao disponivel para a sessao ${sessionName}. Aguarde ou reconecte.`,
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
      console.error('[sessions/qr]', error?.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: 'Falha ao buscar QR code',
      });
    }
  }
);

/**
 * POST /api/sessions/disconnect
 */
router.post(
  '/disconnect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      try {
        await wahaService.stopSession(sessionName);
      } catch (e: any) {
        console.log('[sessions/disconnect] stop:', e.response?.data || e.message);
      }
      await prisma.tenant.update({ where: { id: req.tenantId }, data: { wahaSessionName: '' } });
      res.json({ success: true, data: { ok: true } });
    } catch (error: any) {
      console.error('[sessions/disconnect]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao desconectar sessao' });
    }
  }
);

/**
 * GET /api/sessions/status
 */
router.get(
  '/status',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || 'STOPPED';
      const connected = status === 'WORKING';
      res.json({
        success: true,
        data: {
          connected,
          state: connected ? 'CONNECTED' : 'DISCONNECTED',
          status,
          phoneNumber: (session as any)?.me?.id || null,
          sessionName,
          lastCheckedAt: new Date(),
        },
      });
    } catch (error: any) {
      console.error('[sessions/status]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao verificar status' });
    }
  }
);

/**
 * POST /api/sessions/reconnect
 * Force restart - uses WAHA's native /restart endpoint (stop + start)
 */
router.post(
  '/reconnect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      console.log(`[sessions/reconnect] restarting "${sessionName}"`);
      try {
        await wahaService.restartSession(sessionName);
      } catch (e: any) {
        console.log('[sessions/reconnect]', e.response?.data || e.message);
        try {
          await wahaService.stopSession(sessionName);
        } catch {}
        try {
          await wahaService.startSession(sessionName);
        } catch {}
      }
      await prisma.tenant.update({ where: { id: req.tenantId }, data: { wahaSessionName: sessionName } });
      const { session } = await wahaService.getSession(sessionName);
      res.json({ success: true, data: { sessionName, status: session?.status || 'STARTING' } });
    } catch (error: any) {
      console.error('[sessions/reconnect]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao reconectar' });
    }
  }
);

/**
 * GET /api/sessions/debug
 * Raw WAHA state - for troubleshooting only
 */
router.get(
  '/debug',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const diagnostics = await wahaService.getDiagnostics(sessionName);
      res.json({
        success: true,
        data: diagnostics,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.response?.data || error.message });
    }
  }
);

/**
 * GET /api/sessions/debug/chatbot
 * Inspect the latest chatbot activity for the authenticated tenant.
 */
router.get(
  '/debug/chatbot',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const tenantId = req.tenantId;

      if (!tenantId) {
        res.status(400).json({
          success: false,
          error: 'Tenant ausente na requisicao autenticada',
        });
        return;
      }

      const [tenant, latestConversation, latestLead, recentMessages, diagnostics] = await Promise.all([
        prisma.tenant.findUnique({
          where: { id: tenantId },
          select: {
            id: true,
            name: true,
            businessSegment: true,
            plan: true,
            wahaSessionName: true,
            currentMonthUsage: true,
            isActive: true,
          },
        }),
        prisma.conversation.findFirst({
          where: { tenantId },
          orderBy: [{ updatedAt: 'desc' }],
          include: {
            contact: {
              select: {
                id: true,
                name: true,
                whatsappPhone: true,
                whatsappPhoneE164: true,
                lastInboundAt: true,
                lastOutboundAt: true,
              },
            },
          },
        }),
        prisma.lead.findFirst({
          where: { tenantId },
          orderBy: [{ updatedAt: 'desc' }],
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            score: true,
            createdAt: true,
            updatedAt: true,
            capturedData: true,
            conversationId: true,
            contactId: true,
          },
        }),
        prisma.message.findMany({
          where: { tenantId },
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
          select: {
            id: true,
            externalMessageId: true,
            direction: true,
            body: true,
            sentAt: true,
            createdAt: true,
            providerPayload: true,
            conversationId: true,
            contactId: true,
          },
        }),
        wahaService.getDiagnostics(sessionName),
      ]);

      res.json({
        success: true,
        data: {
          tenant,
          sessionName,
          diagnostics,
          latestConversation,
          latestLead,
          recentMessages,
        },
      });
    } catch (error: any) {
      console.error('[sessions/debug/chatbot]', error?.response?.data || error.message);
      res.status(500).json({
        success: false,
        error: error?.response?.data || error.message || 'Falha ao inspecionar chatbot',
      });
    }
  }
);

export default router;
