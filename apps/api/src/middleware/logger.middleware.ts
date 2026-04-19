import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';

/**
 * Logger de requisições customizado
 * Registra: timestamp, método, path, status, duração, user ID
 */

interface RequestWithTimestamp extends Request {
  startTime?: number;
}

/**
 * Middleware para capturar tempo de início
 */
export function loggerStartTime(
  req: RequestWithTimestamp,
  res: Response,
  next: NextFunction
): void {
  req.startTime = Date.now();
  next();
}

/**
 * Middleware para registrar fim da requisição
 */
export function loggerEndTime(
  req: RequestWithTimestamp,
  res: Response,
  next: NextFunction
): void {
  const originalSend = res.send;

  res.send = function (data: any) {
    const duration = req.startTime ? Date.now() - req.startTime : 0;
    const userId = (req as any).user?.id || 'anonymous';

    const logData = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      query: req.query,
      status: res.statusCode,
      duration: `${duration}ms`,
      userId,
      userAgent: req.headers['user-agent'],
      ip:
        String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.ip || 'unknown',
    };

    // Log em console (em produção seria salvado em arquivo/serviço)
    if (res.statusCode >= 400) {
      console.error(`[${logData.status}]`, logData);
    } else if (duration > 1000) {
      console.warn(`[SLOW]`, logData);
    } else {
      console.log(`[${logData.status}]`, logData);
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Usar morgan para logs detalhados
 * Formato: :method :url :status :response-time ms
 */
export const morganMiddleware = morgan(
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms'
);

/**
 * Middleware para capturar erros não tratados no logger
 */
export function errorLogger(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const userId = (req as any).user?.id || 'anonymous';

  const errorData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    status: err.status || 500,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    userId,
    ip:
      String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip || 'unknown',
  };

  console.error('[ERROR]', errorData);

  next(err);
}

/**
 * Morgan tokens customizados
 */
export function setupMorganTokens(): void {
  morgan.token('user-id', (req: any) => {
    return req.user?.id || 'anonymous';
  });

  morgan.token('tenant-id', (req: any) => {
    return req.tenantId || 'N/A';
  });

  morgan.token('request-id', (req: any) => {
    return req.id || 'N/A';
  });
}

/**
 * Middleware para gerar request ID
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  (req as any).id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  res.setHeader('X-Request-ID', (req as any).id);
  next();
}
