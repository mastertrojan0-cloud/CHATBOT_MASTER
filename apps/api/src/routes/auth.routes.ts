import { Router, Response, Request } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { publicLimiter, validate } from '../middleware';
import { sendSuccess, sendError } from '../lib/response';
import { supabase } from '../config/supabase';
import { prisma } from '@flowdesk/db';
import { PlanType, BusinessSegment, TenantUserRole } from '@prisma/client';

const router = Router();

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Senha obrigatória'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  businessName: z.string().min(2, 'Nome deve ter ao menos 2 caracteres'),
  fullName: z.string().optional(),
  segment: z.string().optional(),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Muitas tentativas. Aguarde 15 minutos.',
    },
  },
});

function generateSlug(text: string): string {
  const normalized = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const slug = normalized.replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return slug || 'tenant';
}

function generateUniqueSlug(baseSlug: string, existingSlugs: string[]): string {
  let slug = baseSlug;
  let counter = 1;
  while (existingSlugs.includes(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  return slug;
}

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      const normalizedEmail = String(email).trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.session) {
        const message = (error?.message || '').toLowerCase();

        if (message.includes('email not confirmed')) {
          sendError(res, 'Confirme seu email antes de entrar', 'EMAIL_NOT_CONFIRMED', 403);
          return;
        }

        if (message.includes('too many requests')) {
          sendError(res, 'Muitas tentativas. Aguarde alguns minutos e tente novamente.', 'TOO_MANY_REQUESTS', 429);
          return;
        }

        sendError(res, 'Email ou senha inválidos', 'INVALID_CREDENTIALS', 401);
        return;
      }

      sendSuccess(res, {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresIn: data.session.expires_in,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      sendError(res, 'Login failed', 'LOGIN_ERROR', 500);
    }
  }
);

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  async (req: Request, res: Response) => {
    const { email, password, businessName, fullName, segment } = req.body;

    let supabaseUserId: string | null = null;

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || businessName || email.split('@')[0],
          },
        },
      });

      if (error) {
        sendError(res, error.message, 'REGISTRATION_ERROR', 400);
        return;
      }

      if (!data.user) {
        sendError(res, 'Failed to create user', 'REGISTRATION_ERROR', 400);
        return;
      }

      supabaseUserId = data.user.id;

      const tenantName = businessName || fullName || email.split('@')[0];
      const baseSlug = generateSlug(tenantName);

      const existingTenants = await prisma.tenant.findMany({
        where: { slug: { startsWith: baseSlug } },
        select: { slug: true },
      });
      const existingSlugs = existingTenants.map((t) => t.slug);
      const slug = generateUniqueSlug(baseSlug, existingSlugs);

      const businessSegment = segment
        ? (segment.toUpperCase() as BusinessSegment)
        : BusinessSegment.CLINIC;

      const tenant = await prisma.tenant.create({
        data: {
          name: tenantName,
          slug,
          plan: PlanType.FREE,
          businessSegment,
          isActive: true,
          wahaSessionName: '',
          monthlyConversationLimit: 100,
          monthlyMessageLimit: 200,
          monthlyLeadLimit: 50,
        },
      });

      await prisma.tenantUser.create({
        data: {
          tenantId: tenant.id,
          email,
          fullName: fullName || tenantName,
          role: TenantUserRole.OWNER,
          isActive: true,
        },
      });

      let accessToken: string | undefined;

      if (data.session) {
        accessToken = data.session.access_token;
      } else if (data.user && email && password) {
        const { data: loginData } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        accessToken = loginData.session?.access_token;
      }

      sendSuccess(res, {
        user: { id: supabaseUserId, email },
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan.toLowerCase(),
        },
        token: accessToken,
      });
    } catch (error) {
      console.error('Registration error:', error);

      if (supabaseUserId) {
        try {
          await supabase.auth.admin.deleteUser(supabaseUserId);
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      sendError(res, 'Registration failed', 'REGISTRATION_ERROR', 500);
    }
  }
);

router.post(
  '/refresh',
  publicLimiter,
  async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Refresh token is required',
          },
        });
        return;
      }

      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (error || !data.session) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired refresh token',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          accessToken: data.session.access_token,
          refreshToken: data.session.refresh_token,
          expiresIn: data.session.expires_in,
        },
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'REFRESH_ERROR',
          message: 'Token refresh failed',
        },
      });
    }
  }
);

export default router;
