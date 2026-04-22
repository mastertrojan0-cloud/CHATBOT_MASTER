import { Router, Response } from 'express';
import { AuthRequest } from '../types';
import { requireAuth, authenticatedLimiter } from '../middleware';
import { wahaService } from '../services/waha.service';
import { prisma } from '@flowdesk/db';

const router = Router();
const WAHA_SESSION_NAME = process.env.WAHA_SESSION_NAME || 'default';
const LEGACY_SHARED_SESSION_NAME = 'default';
const WAHA_MULTI_SESSION_ENABLED = ['1', 'true', 'yes', 'on'].includes(
  String(process.env.WAHA_MULTI_SESSION || '').trim().toLowerCase()
);

// Real WAHA statuses that mean "do not restart"
// Docs: STOPPED | STARTING | SCAN_QR_CODE | WORKING | FAILED
const DO_NOT_RESTART = ['WORKING', 'SCAN_QR_CODE', 'STARTING'];

function buildTenantSessionBase(tenantId: string): string {
  const normalizedTenantId = tenantId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `tenant-${normalizedTenantId.slice(0, 24)}`;
}

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

function getRequestBaseUrl(req: AuthRequest): string | undefined {
  const forwardedProto = req.header('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.header('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost || req.header('host')?.trim();

  if (!host) {
    return undefined;
  }

  const protocol = forwardedProto || (req.secure ? 'https' : 'http');
  return `${protocol}://${host}`.replace(/\/$/, '');
}

async function getSessionName(req: AuthRequest): Promise<string> {
  if (!req.tenantId || !WAHA_MULTI_SESSION_ENABLED) {
    return WAHA_SESSION_NAME;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { wahaSessionName: true },
  });

  const boundSessionName = tenant?.wahaSessionName?.trim();
  if (boundSessionName && boundSessionName !== LEGACY_SHARED_SESSION_NAME) {
    return boundSessionName;
  }

  // Deterministic per-tenant session name prevents cross-tenant reuse.
  return buildTenantSessionBase(req.tenantId);
}

async function getTenantBoundSessionName(req: AuthRequest): Promise<string> {
  if (!req.tenantId) {
    return '';
  }

  if (!WAHA_MULTI_SESSION_ENABLED) {
    return WAHA_SESSION_NAME;
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: req.tenantId },
    select: { wahaSessionName: true },
  });

  return tenant?.wahaSessionName?.trim() || '';
}

async function bindSessionToTenant(
  req: AuthRequest,
  sessionName: string,
  transferOwnership = false
): Promise<{ ok: true } | { ok: false; status: number; error: string; details?: unknown }> {
  if (!req.tenantId) {
    return { ok: false, status: 400, error: 'Tenant ausente na requisicao autenticada' };
  }

  const conflictingTenants = await prisma.tenant.findMany({
    where: {
      id: { not: req.tenantId },
      wahaSessionName: sessionName,
    },
    select: {
      id: true,
      name: true,
      isActive: true,
      updatedAt: true,
    },
  });

  const effectiveTransferOwnership =
    transferOwnership || (!WAHA_MULTI_SESSION_ENABLED && sessionName === WAHA_SESSION_NAME);

  if (conflictingTenants.length > 0 && !effectiveTransferOwnership) {
    return {
      ok: false,
      status: 409,
      error: 'Sessao WhatsApp ja vinculada a outro tenant. Use transferOwnership=true para transferencia controlada.',
      details: {
        sessionName,
        ownerTenantIds: conflictingTenants.map((tenant) => tenant.id),
      },
    };
  }

  await prisma.$transaction(async (tx) => {
    if (conflictingTenants.length > 0 && effectiveTransferOwnership) {
      await tx.tenant.updateMany({
        where: { id: { in: conflictingTenants.map((tenant) => tenant.id) } },
        data: { wahaSessionName: '' },
      });
    }

    await tx.tenant.update({
      where: { id: req.tenantId! },
      data: { wahaSessionName: sessionName },
    });
  });

  return { ok: true };
}

function getWebhookBaseUrl(req: AuthRequest): string {
  return getFirstValidBaseUrl(
    getRequestBaseUrl(req),
    process.env.WAHA_WEBHOOK_BASE_URL,
    process.env.RAILWAY_STATIC_URL,
    process.env.APP_URL
  );
}

function getWebhookUrl(req: AuthRequest, sessionName: string): string {
  return `${getWebhookBaseUrl(req)}/api/webhooks/waha/${sessionName}`;
}

function tenantOwnsSession(boundSessionName: string, sessionName: string): boolean {
  if (!WAHA_MULTI_SESSION_ENABLED) {
    return sessionName === WAHA_SESSION_NAME;
  }

  return boundSessionName !== '' && boundSessionName === sessionName;
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
      const boundSessionName = await getTenantBoundSessionName(req);
      const ownsSession = tenantOwnsSession(boundSessionName, sessionName);
      const { session } = await wahaService.getSession(sessionName);
      const status = ownsSession ? (session?.status || 'STOPPED') : 'STOPPED';
      console.log(`[sessions/current] status="${status}" me=${JSON.stringify((session as any)?.me)}`);
      res.json({
        success: true,
        data: {
          status,
          phoneNumber: ownsSession ? (session as any)?.me?.id || null : null,
          sessionName,
          ownsSession,
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
      const transferOwnership = req.body?.transferOwnership === true;
      const webhookUrl = getWebhookUrl(req, sessionName);
      console.log(`[sessions/connect] webhook="${webhookUrl}"`);

      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || '';
      console.log(`[sessions/connect] current status="${status}"`);

      if (DO_NOT_RESTART.includes(status)) {
        const bindResult = await bindSessionToTenant(req, sessionName, transferOwnership);
        if (bindResult.ok === false) {
          res.status(bindResult.status).json({ success: false, error: bindResult.error, details: bindResult.details });
          return;
        }
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

        const bindResult = await bindSessionToTenant(req, sessionName, transferOwnership);
        if (bindResult.ok === false) {
          res.status(bindResult.status).json({ success: false, error: bindResult.error, details: bindResult.details });
          return;
        }
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

      const bindResult = await bindSessionToTenant(req, sessionName, transferOwnership);
      if (bindResult.ok === false) {
        res.status(bindResult.status).json({ success: false, error: bindResult.error, details: bindResult.details });
        return;
      }
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
 * GET /api/sessions/qr-image
 * Proxy WAHA QR code as binary PNG (no base64 encoding issues)
 */
router.get(
  '/qr-image',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);

      const sendPng = (buffer: Buffer) => {
        res.set('Content-Type', 'image/png');
        res.set('Cache-Control', 'no-store');
        res.send(buffer);
      };

      const pngBuffer = await wahaService.getQrCodeImage(sessionName);
      if (pngBuffer) {
        sendPng(pngBuffer);
        return;
      }

      // Fallback: fetch base64 QR and convert to PNG buffer.
      const qrResult = await wahaService.getQrCode(sessionName);
      const code = qrResult.qr?.code;
      if (code) {
        const base64 = code.includes(',') ? code.split(',')[1] : code;
        const fallbackBuffer = Buffer.from(base64, 'base64');
        sendPng(fallbackBuffer);
        return;
      }

      res.status(503).json({ success: false, error: 'QR temporariamente indisponivel' });
    } catch (error: any) {
      console.error('[sessions/qr-image]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao buscar QR code' });
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
      const boundSessionName = await getTenantBoundSessionName(req);
      const ownsSession = tenantOwnsSession(boundSessionName, sessionName);
      const { session } = await wahaService.getSession(sessionName);
      const status = session?.status || 'STOPPED';
      const connected = ownsSession && status === 'WORKING';
      res.json({
        success: true,
        data: {
          connected,
          state: connected ? 'CONNECTED' : 'DISCONNECTED',
          status,
          phoneNumber: connected ? (session as any)?.me?.id || null : null,
          sessionName,
          ownsSession,
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
 * Force reconnect with fresh webhook config.
 * Uses PUT which stops+restarts automatically if session is not STOPPED.
 * If session doesn't exist, creates it.
 */
router.post(
  '/reconnect',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const sessionName = await getSessionName(req);
      const transferOwnership = req.body?.transferOwnership === true;
      const webhookUrl = getWebhookUrl(req, sessionName);
      console.log(`[sessions/reconnect] "${sessionName}" webhook="${webhookUrl}"`);

      const { session } = await wahaService.getSession(sessionName);

      if (session) {
        // PUT stops+restarts the session automatically regardless of current state
        try {
          await wahaService.updateSessionConfig(sessionName, webhookUrl);
        } catch (e: any) {
          console.log('[sessions/reconnect] updateConfig error:', e.response?.data || e.message);
          // If PUT fails, try explicit stop+start
          try { await wahaService.stopSession(sessionName); } catch {}
          await wahaService.startSession(sessionName);
        }
      } else {
        // Session doesn't exist — create it (auto-starts with webhook)
        await wahaService.createSession(sessionName, webhookUrl);
      }

      const bindResult = await bindSessionToTenant(req, sessionName, transferOwnership);
      if (bindResult.ok === false) {
        res.status(bindResult.status).json({ success: false, error: bindResult.error, details: bindResult.details });
        return;
      }
      const { session: updatedSession } = await wahaService.getSession(sessionName);
      res.json({ success: true, data: { sessionName, status: updatedSession?.status || 'STARTING' } });
    } catch (error: any) {
      console.error('[sessions/reconnect]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao reconectar' });
    }
  }
);

/**
 * POST /api/sessions/reset
 * Stop current tenant session, clear binding and force a fresh tenant session (new QR required).
 */
router.post(
  '/reset',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const transferOwnership = req.body?.transferOwnership === true;
      const boundSessionName = await getTenantBoundSessionName(req);
      const currentSessionName = boundSessionName || (await getSessionName(req));

      try {
        await wahaService.stopSession(currentSessionName);
      } catch (e: any) {
        console.log('[sessions/reset] stop:', e.response?.data || e.message);
      }

      // Logout drops WA auth and guarantees fresh QR on next connect.
      try {
        await wahaService.logoutSession(currentSessionName);
      } catch (e: any) {
        console.log('[sessions/reset] logout:', e.response?.data || e.message);
      }

      if (!req.tenantId) {
        res.status(400).json({ success: false, error: 'Tenant ausente na requisicao autenticada' });
        return;
      }

      const baseSessionName = buildTenantSessionBase(req.tenantId);
      const freshSuffix = Date.now().toString(36).slice(-6);
      const freshSessionName = WAHA_MULTI_SESSION_ENABLED
        ? `${baseSessionName}-${freshSuffix}`
        : WAHA_SESSION_NAME;
      const webhookUrl = getWebhookUrl(req, freshSessionName);

      await prisma.tenant.update({
        where: { id: req.tenantId },
        data: { wahaSessionName: '' },
      });

      const bindResult = await bindSessionToTenant(req, freshSessionName, transferOwnership);
      if (bindResult.ok === false) {
        res.status(bindResult.status).json({ success: false, error: bindResult.error, details: bindResult.details });
        return;
      }

      const { session } = await wahaService.getSession(freshSessionName);
      if (session) {
        try {
          await wahaService.stopSession(freshSessionName);
        } catch {}
        try {
          await wahaService.logoutSession(freshSessionName);
        } catch {}
        try {
          await wahaService.updateSessionConfig(freshSessionName, webhookUrl);
        } catch (e: any) {
          console.log('[sessions/reset] updateConfig:', e.response?.data || e.message);
        }
        await wahaService.startSession(freshSessionName);
      } else {
        await wahaService.createSession(freshSessionName, webhookUrl);
      }

      const { session: updatedSession } = await wahaService.getSession(freshSessionName);
      let qr: string | null = null;
      if (updatedSession?.status === 'SCAN_QR_CODE') {
        try {
          const qrResult = await wahaService.getQrCode(freshSessionName);
          qr = qrResult.qr?.code || null;
        } catch (e: any) {
          console.log('[sessions/reset] qr:', e.response?.data || e.message);
        }
      }

      res.json({
        success: true,
        data: {
          previousSessionName: currentSessionName,
          sessionName: freshSessionName,
          status: updatedSession?.status || 'STARTING',
          qr,
        },
      });
    } catch (error: any) {
      console.error('[sessions/reset]', error?.response?.data || error.message);
      res.status(500).json({ success: false, error: 'Falha ao resetar sessao' });
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
