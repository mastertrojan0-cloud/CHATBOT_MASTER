import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {
  authMiddleware,
  publicLimiter,
  morganMiddleware,
  loggerStartTime,
  loggerEndTime,
  requestIdMiddleware,
  setupMorganTokens,
  errorLogger,
} from './middleware';
import { leadsRoutes, sessionsRoutes, tenantsRoutes, metricsRoutes } from './routes';
import authRoutes from './routes/auth.routes';
import { connectDb } from '@flowdesk/db';
import { weeklyReportJob } from './jobs/weekly-report.job';
import { stripeWebhookHandler } from './webhooks/stripe.webhook';
import { wahaWebhookHandler } from './webhooks/waha.webhook';
import { telegramWebhookHandler } from './webhooks/telegram.webhook';
import { logger } from './lib/logger';
import { wahaService } from './services/waha.service';
import './config/env';

const app: Express = express();
const port = process.env.PORT || 3000;
let dbConnected = false;
let dbError: string | null = null;

setupMorganTokens();

app.use(requestIdMiddleware);
app.use(compression() as any);
app.use(morganMiddleware);
app.use(loggerStartTime);
app.use(loggerEndTime);
app.use(helmet());

const allowedOrigins = [
  'https://chatbot-master-dashboard.vercel.app',
  'https://dashboard-xi-seven-24.vercel.app',
  'https://dashboard-mastertrojan0-clouds-projects.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter((origin): origin is string => Boolean(origin));

const allowedOriginPatterns = [
  /^https:\/\/dashboard-[a-z0-9-]+\.vercel\.app$/i,
  /^https:\/\/dashboard-[a-z0-9-]+-mastertrojan0-clouds-projects\.vercel\.app$/i,
];

app.use(cors({
  origin: (origin, callback) => {
    const isPatternAllowed = Boolean(origin) && allowedOriginPatterns.some((pattern) => pattern.test(origin));
    if (!origin || allowedOrigins.includes(origin) || isPatternAllowed) {
      callback(null, true);
      return;
    }

    console.warn('[CORS] Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Muitas requisicoes.',
    },
  },
});

app.use(globalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api/public/', publicLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is running',
    dbConnected,
    dbError,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is healthy',
    dbConnected,
    dbError,
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health/waha', async (_req: Request, res: Response) => {
  try {
    const diagnostics = await wahaService.getDiagnostics(process.env.WAHA_SESSION_NAME || 'default');
    const session = (diagnostics.session as { session?: { status?: string } | null } | undefined)?.session || null;

    res.json({
      success: true,
      data: {
        healthy: Boolean(diagnostics.instance) || Boolean(diagnostics.session),
        status: session?.status || null,
        dbConnected,
        dbError,
        diagnostics,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error?.response?.data || error?.message || 'Failed to inspect WAHA',
    });
  }
});

app.get('/api/health/telegram', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      dbConnected,
      dbError,
      timestamp: new Date().toISOString(),
    },
  });
});

app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);
app.post('/api/webhooks/waha/:sessionName', express.json(), wahaWebhookHandler);
app.post('/api/webhooks/telegram/:tenantSlug', express.json(), telegramWebhookHandler);
app.use('/api/auth', authRoutes);

app.use('/api/', authMiddleware);

app.post('/api/auth/logout', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Alias endpoint required by dashboard action.
app.post('/api/whatsapp/reset', (req: Request, res: Response, next: NextFunction) => {
  req.url = '/reset';
  (sessionsRoutes as any).handle(req, res, next);
});

app.use('/api/leads', leadsRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/tenants', tenantsRoutes);
app.use('/api/metrics', metricsRoutes);

app.use(errorLogger);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[GLOBAL ERROR]', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

const startServer = async () => {
  try {
    try {
      await connectDb();
      dbConnected = true;
      dbError = null;
      logger.info('Database connected');
      weeklyReportJob.start();
    } catch (error: any) {
      dbConnected = false;
      dbError = error?.message || 'Database connection failed';
      logger.error({ err: error }, 'Database unavailable on boot, starting in degraded mode');
      logger.warn('Weekly report job disabled because database is unavailable');
    }

    const server = app.listen(port, () => {
      logger.info(
        {
          port,
          env: process.env.NODE_ENV || 'development',
          frontend: process.env.FRONTEND_URL || 'http://localhost:5173',
          dbConnected,
          dbError,
        },
        'Server started'
      );
    });

    process.on('SIGTERM', () => {
      console.log('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT signal received: closing HTTP server');
      server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
