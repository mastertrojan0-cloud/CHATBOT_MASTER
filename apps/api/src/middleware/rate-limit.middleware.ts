import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Rate limit por IP para rotas públicas/webhooks
 */
export const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // 100 requisições por IP
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true, // Retorna rate limit info no header
  legacyHeaders: false, // Desabilita X-RateLimit-* headers
  skip: (req: Request) => {
    // Skip para health checks
    return req.path === '/health';
  },
});

/**
 * Rate limit por IP para webhooks (mais restritivo)
 */
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 50, // 50 requisições por IP
  message: 'Too many webhook requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usar IP real mesmo atrás de proxy
    return (
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      'unknown'
    );
  },
});

/**
 * Rate limit por usuário autenticado (mais permissivo)
 */
export const authenticatedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // 1000 requisições por usuário
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Usar ID do usuário se autenticado, senão IP
    return (req as any).user?.id || req.ip || 'unknown';
  },
});

/**
 * Rate limit para rotas críticas (login, reset password, etc)
 */
export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 tentativas
  message: 'Too many attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Não contar requisições bem-sucedidas
  keyGenerator: (req: Request) => {
    return (
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip ||
      'unknown'
    );
  },
});

/**
 * Middleware customizado para limitar por API key
 */
export function apiKeyLimiter(options?: { windowMs?: number; max?: number }) {
  const windowMs = options?.windowMs || 60 * 60 * 1000; // 1 hora
  const max = options?.max || 10000; // 10k requisições

  const limiters = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
      return next();
    }

    const now = Date.now();
    let limiter = limiters.get(apiKey);

    // Resetar se passou do tempo
    if (!limiter || now > limiter.resetTime) {
      limiter = {
        count: 0,
        resetTime: now + windowMs,
      };
      limiters.set(apiKey, limiter);
    }

    limiter.count++;

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - limiter.count));
    res.setHeader('X-RateLimit-Reset', limiter.resetTime);

    if (limiter.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'API rate limit exceeded',
        },
      });
    }

    next();
  };
}
