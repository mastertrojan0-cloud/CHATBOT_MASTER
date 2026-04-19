import { Router, Response } from 'express';
import { AuthRequest, Tenant, UpdateTenantDTO, StripeCheckoutSession } from '../types';
import { requireAuth, requirePro, authenticatedLimiter } from '../middleware';
import { stripe } from '../config/stripe';
import { prisma } from '@flowdesk/db';
import { PlanType } from '@prisma/client';

const router = Router();

/**
 * GET /api/tenants/me
 * Obter dados do tenant atual
 */
router.get(
  '/me',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        include: {
          users: {
            where: { role: 'OWNER' },
            select: { email: true, fullName: true },
            take: 1,
          },
        },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      const owner = tenant.users[0];

      res.json({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan.toLowerCase(),
          isActive: tenant.isActive,
          businessSegment: tenant.businessSegment,
          wahaSessionName: tenant.wahaSessionName,
          wahaConnected: tenant.wahaSessionName !== '',
          monthlyMessageLimit: tenant.monthlyMessageLimit,
          monthlyLeadLimit: tenant.monthlyLeadLimit,
          currentMonthUsage: tenant.currentMonthUsage,
          notifyEmail: tenant.notifyEmail,
          notifyPhone: tenant.notifyPhone,
          stripeCustomerId: tenant.stripeCustomerId,
          planExpiresAt: tenant.planExpiresAt,
          owner: owner ? { email: owner.email, fullName: owner.fullName } : null,
        },
      });
    } catch (error) {
      console.error('Error fetching tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao buscar tenant',
      });
    }
  }
);

/**
 * PATCH /api/tenants/me
 * Atualizar dados do tenant
 */
router.patch(
  '/me',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { name, notifyEmail, notifyPhone } = req.body as {
        name?: string;
        notifyEmail?: string;
        notifyPhone?: string;
      };

      if (name !== undefined && typeof name !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Name deve ser uma string',
        });
        return;
      }

      if (name && name.trim().length < 2) {
        res.status(400).json({
          success: false,
          error: 'Name deve ter pelo menos 2 caracteres',
        });
        return;
      }

      const updates: any = {};
      if (name) updates.name = name.trim();
      if (notifyEmail !== undefined) updates.notifyEmail = notifyEmail || null;
      if (notifyPhone !== undefined) updates.notifyPhone = notifyPhone || null;

      const tenant = await prisma.tenant.update({
        where: { id: req.tenantId },
        data: updates,
      });

      res.json({
        success: true,
        data: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan.toLowerCase(),
          notifyEmail: tenant.notifyEmail,
          notifyPhone: tenant.notifyPhone,
          updatedAt: tenant.updatedAt,
        },
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao atualizar tenant',
      });
    }
  }
);

/**
 * GET /api/tenants/me/notifications
 * Obter configurações de notificações
 */
router.get(
  '/me/notifications',
  authenticatedLimiter,
  requireAuth,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Buscar do banco de dados
      const settings = {
        waNotifications: true,
        emailNotifications: true,
        newLeadAlert: true,
        messageAlert: true,
      };

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_NOTIFICATIONS_ERROR',
          message: 'Failed to fetch notifications',
        },
      });
    }
  }
);

/**
 * PATCH /api/tenants/me/notifications
 * Atualizar configurações de notificações
 */
router.patch(
  '/me/notifications',
  authenticatedLimiter,
  requireAuth,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      const { waNotifications, emailNotifications, newLeadAlert, messageAlert } = req.body;

      // TODO: Atualizar no banco de dados
      const settings = {
        waNotifications: waNotifications ?? true,
        emailNotifications: emailNotifications ?? true,
        newLeadAlert: newLeadAlert ?? true,
        messageAlert: messageAlert ?? true,
      };

      res.json({
        success: true,
        data: settings,
      });
    } catch (error) {
      console.error('Error updating notifications:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_NOTIFICATIONS_ERROR',
          message: 'Failed to update notifications',
        },
      });
    }
  }
);

/**
 * POST /api/tenants/me/google-sheets
 * Conectar Google Sheets (OAuth callback)
 */
router.post(
  '/me/google-sheets',
  authenticatedLimiter,
  requireAuth,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      const { spreadsheetId, sheetName } = req.body;

      if (!spreadsheetId || !sheetName) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PARAMS',
            message: 'Missing spreadsheetId or sheetName',
          },
        });
        return;
      }

      // TODO: Validar acesso ao Google Sheets
      // TODO: Salvar no banco de dados

      const config = {
        id: 'sheets-config-1',
        tenantId: req.tenantId!,
        spreadsheetId,
        sheetName,
        syncEnabled: true,
        connectedAt: new Date(),
      };

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error('Error connecting Google Sheets:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'GOOGLE_SHEETS_ERROR',
          message: 'Failed to connect Google Sheets',
        },
      });
    }
  }
);

/**
 * GET /api/tenants/me/google-sheets
 * Obter configuração do Google Sheets
 */
router.get(
  '/me/google-sheets',
  authenticatedLimiter,
  requireAuth,
  requirePro,
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Buscar do banco de dados
      const config = {
        id: 'sheets-config-1',
        tenantId: req.tenantId!,
        spreadsheetId: 'abc123...',
        sheetName: 'Leads',
        syncEnabled: true,
        connectedAt: new Date(),
      };

      res.json({
        success: true,
        data: config,
      });
    } catch (error) {
      console.error('Error fetching Google Sheets config:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_SHEETS_ERROR',
          message: 'Failed to fetch Google Sheets config',
        },
      });
    }
  }
);

/**
 * POST /api/tenants/me/upgrade
 * Criar sessão de checkout Stripe (upgrade para Pro)
 */
router.post(
  '/me/upgrade',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { plan: true },
      });

      if (!tenant) {
        res.status(404).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      if (tenant.plan === PlanType.PRO) {
        res.status(400).json({
          success: false,
          error: 'Plano já é PRO',
        });
        return;
      }

      const priceId = process.env.STRIPE_PRO_PRICE_ID;

      if (!priceId) {
        res.status(500).json({
          success: false,
          error: 'Configuração de pagamento incompleta',
        });
        return;
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{
          price: priceId,
          quantity: 1,
        }],
        metadata: {
          tenantId: req.tenantId!,
        },
        success_url: `${process.env.FRONTEND_URL}/dashboard?upgraded=true`,
        cancel_url: `${process.env.FRONTEND_URL}/dashboard/settings`,
        client_reference_id: req.tenantId,
      });

      res.json({
        success: true,
        data: { url: session.url },
      });
    } catch (error) {
      console.error('Error creating checkout session:', error);
      res.status(500).json({
        success: false,
        error: 'Falha ao criar sessão de pagamento',
      });
    }
  }
);

/**
 * POST /api/tenants/me/cancel-subscription
 * Cancelar subscription Pro
 */
router.post(
  '/me/cancel-subscription',
  authenticatedLimiter,
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      // TODO: Buscar Stripe customer ID do tenant
      // TODO: Cancelar subscription
      // const subscription = await stripe.subscriptions.del(subscriptionId);

      res.json({
        success: true,
        data: { canceled: true },
      });
    } catch (error) {
      console.error('Error canceling subscription:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: 'Failed to cancel subscription',
        },
      });
    }
  }
);

export default router;
