import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
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

const app: Express = express();
const port = process.env.PORT || 3000;

// ==================== SETUP ====================

// Setup Morgan tokens
setupMorganTokens();

// ==================== MIDDLEWARES ====================

// Request ID
app.use(requestIdMiddleware);

// Logging
app.use(morganMiddleware);
app.use(loggerStartTime);
app.use(loggerEndTime);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL || '',
  'https://chatbot-master-dashboard.vercel.app',
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  })
);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting para rotas públicas
app.use('/api/public/', publicLimiter);

// ==================== HEALTH CHECKS ====================

app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
  });
});

// ==================== PUBLIC ROUTES ====================

// Stripe webhook (MUST come before express.json)
app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// WAHA webhook
app.post('/api/webhooks/waha/:sessionName', express.json(), wahaWebhookHandler);

// Auth routes (públicas)
app.use('/api/auth', authRoutes);

// ==================== PROTECTED ROUTES ====================

// Autenticação
app.use('/api/', authMiddleware);

// Auth routes
app.post('/api/auth/logout', (req: Request, res: Response) => {
  // Logout é stateless - apenas retorna sucesso
  // Cliente remove o token localStorage
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Leads
app.use('/api/leads', leadsRoutes);

// Sessions (WhatsApp)
app.use('/api/sessions', sessionsRoutes);

// Tenants
app.use('/api/tenants', tenantsRoutes);

// Metrics
app.use('/api/metrics', metricsRoutes);

// 404 handler

// Error logger
app.use(errorLogger);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[GLOBAL ERROR]', err);

  res.status(err.status || 500).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

// ==================== START SERVER ====================

const startServer = async () => {
  try {
    // Connect to database
    await connectDb();
    console.log('✅ Database connected');

    // Start jobs
    weeklyReportJob.start();

    const server = app.listen(port, () => {
      console.log(`
╔════════════════════════════════════════╗
║      FlowDesk API Server Started       ║
╠════════════════════════════════════════╣
║ Port:     ${port.toString().padEnd(30)} ║
║ Env:      ${(process.env.NODE_ENV || 'development').padEnd(26)} ║
║ Frontend: ${(process.env.FRONTEND_URL || 'http://localhost:5173').padEnd(21)} ║
╚════════════════════════════════════════╝
  `);
    });

    // Graceful shutdown
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
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
