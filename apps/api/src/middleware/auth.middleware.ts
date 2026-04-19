import { Response, NextFunction } from 'express';
import { AuthRequest, AuthUser } from '../types';
import { verifySupabaseJWT } from '../config/supabase';
import { prisma } from '@flowdesk/db';
import { PlanType } from '@prisma/client';

interface TenantCacheEntry {
  plan: PlanType;
  isActive: boolean;
  expiresAt: number;
}

const tenantCache = new Map<string, TenantCacheEntry>();
const CACHE_TTL = 30000;

function getCachedTenant(tenantId: string): TenantCacheEntry | null {
  const entry = tenantCache.get(tenantId);
  if (entry && entry.expiresAt > Date.now()) {
    return entry;
  }
  return null;
}

function setCachedTenant(tenantId: string, plan: PlanType, isActive: boolean): void {
  tenantCache.set(tenantId, {
    plan,
    isActive,
    expiresAt: Date.now() + CACHE_TTL,
  });
}

function invalidateTenantCache(tenantId: string): void {
  tenantCache.delete(tenantId);
}

/**
 * Middleware de autenticação
 * Valida o token JWT do Supabase e injeta o usuário no request
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: 'Token não informado',
      });
      return;
    }

    const token = authHeader.slice(7);

    try {
      const supabaseUser = await verifySupabaseJWT(token);
      const userEmail = supabaseUser.email || '';

      const tenantUser = await prisma.tenantUser.findFirst({
        where: { email: userEmail, isActive: true },
        include: { tenant: { select: { id: true, name: true } } },
      });

      if (!tenantUser) {
        res.status(401).json({
          success: false,
          error: 'Usuário não encontrado',
        });
        return;
      }

      req.user = {
        id: supabaseUser.id,
        email: userEmail,
        tenantId: tenantUser.tenant.id,
      } as AuthUser;

      req.tenantId = tenantUser.tenant.id;

      next();
    } catch (error) {
      console.error('Auth error:', error);
      res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
      });
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Erro interno de autenticação',
    });
  }
}

/**
 * Middleware para rotas que exigem autenticação
 */
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Não autorizado',
    });
    return;
  }

  next();
}

/**
 * Middleware para verificar se é Pro (com cache)
 */
export async function requirePro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Não autorizado',
    });
    return;
  }

  try {
    const tenantId = req.user.tenantId;

    let cached = getCachedTenant(tenantId);

    if (!cached) {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { plan: true, isActive: true },
      });

      if (!tenant) {
        res.status(403).json({
          success: false,
          error: 'Tenant não encontrado',
        });
        return;
      }

      cached = {
        plan: tenant.plan,
        isActive: tenant.isActive,
        expiresAt: 0,
      };
      setCachedTenant(tenantId, tenant.plan, tenant.isActive);
    }

    if (!cached.isActive) {
      res.status(403).json({
        success: false,
        error: 'Conta suspensa. Verifique seu pagamento.',
      });
      return;
    }

    if (cached.plan !== PlanType.PRO) {
      res.status(403).json({
        success: false,
        error: 'Recurso disponível apenas no plano Pro.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error checking plan:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar plano',
    });
  }
}

export { invalidateTenantCache };
