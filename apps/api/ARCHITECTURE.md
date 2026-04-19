# 🏛️ FlowDesk API - Architecture

Visão geral da arquitetura, fluxos e padrões da API.

## Request Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Dashboard)                  │
└─────────────────────────────────────────┬───────────────────────┘
                                          │
                                          ↓
                     ┌─────────────────────────────────────────┐
                     │   HTTP Request + JWT Token              │
                     │   Authorization: Bearer <token>         │
                     └────────────────┬────────────────────────┘
                                      ↓
                 ┌────────────────────────────────────────────┐
                 │         requestIdMiddleware                │
                 │  (Gera ID único para tracking)             │
                 └────────────┬───────────────────────────────┘
                              ↓
                 ┌────────────────────────────────────────────┐
                 │      Morgan Logger Middleware              │
                 │  (Registra request, response, duração)     │
                 └────────────┬───────────────────────────────┘
                              ↓
                 ┌────────────────────────────────────────────┐
                 │         CORS Middleware                    │
                 │  (Permite requisições de localhost:5173)   │
                 └────────────┬───────────────────────────────┘
                              ↓
                 ┌────────────────────────────────────────────┐
                 │      Body Parser Middleware                │
                 │  (JSON + URL encoded, max 10MB)            │
                 └────────────┬───────────────────────────────┘
                              ↓
        ┌────────────────────────────────────────────────┐
        │                                                │
        ├─→ /health, /api/health (público)             │
        │                                                │
        ├─→ /api/webhooks/* (público, rate-limited)    │
        │   └─ POST /api/webhooks/stripe               │
        │   └─ POST /api/webhooks/waha                 │
        │                                                │
        └─→ /api/* (requer autenticação)               │
            ↓                                            │
    ┌─────────────────────────────────────────┐         │
    │    authMiddleware                       │         │
    │  1. Extrai token do header              │         │
    │  2. Valida JWT com Supabase             │         │
    │  3. Injeta user em req.user             │         │
    │  4. Injeta tenantId em req.tenantId     │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │    Rate Limiting (baseado no tipo)      │         │
    │  - Public: 100 req/15min                │         │
    │  - Authenticated: 1000 req/15min        │         │
    │  - Strict: 5 req/15min                  │         │
    │  - Webhooks: 50 req/1min                │         │
    │  - API Key: Customizável                │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │    Route Guard (requireAuth/requirePro) │         │
    │  - requireAuth: 401 se sem user         │         │
    │  - requirePro: 403 se plan != 'pro'     │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │          Route Handler                  │         │
    │  ├─ GET  /api/leads                     │         │
    │  ├─ GET  /api/leads/stats               │         │
    │  ├─ PATCH /api/leads/:id                │         │
    │  ├─ DELETE /api/leads/:id               │         │
    │  ├─ GET  /api/leads/export/csv (Pro)    │         │
    │  ├─ GET  /api/sessions/current          │         │
    │  ├─ POST /api/sessions/connect          │         │
    │  ├─ GET  /api/sessions/qr               │         │
    │  ├─ GET  /api/tenants/me                │         │
    │  ├─ PATCH /api/tenants/me               │         │
    │  ├─ POST /api/tenants/me/upgrade        │         │
    │  └─ ... (20 endpoints total)            │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │    Controller Logic                     │         │
    │  (Chamada Supabase, WAHA, Stripe)       │         │
    │  (TODO: Implementar queries)            │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │       Resposta JSON                     │         │
    │  {                                      │         │
    │    "success": true,                     │         │
    │    "data": { ... },                     │         │
    │    "meta": {                            │         │
    │      "timestamp": "2024-01-15T..."      │         │
    │    }                                    │         │
    │  }                                      │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
    ┌─────────────────────────────────────────┐         │
    │    loggerEndTime Middleware             │         │
    │  (Calcula duração, registra log)        │         │
    └─────────┬───────────────────────────────┘         │
              ↓                                          │
┌────────────────────────────────────────────────────────┐
│              Frontend Recebe Resposta                  │
│        (React Query, Zustand, UI Update)              │
└────────────────────────────────────────────────────────┘
```

## Estrutura de Diretórios

```
apps/api/
├── src/
│   ├── server.ts                    # Express app + middleware setup
│   │
│   ├── routes/                      # Rotas HTTP
│   │   ├── leads.routes.ts
│   │   ├── sessions.routes.ts
│   │   ├── tenants.routes.ts
│   │   └── index.ts
│   │
│   ├── middleware/                  # Express middleware
│   │   ├── auth.middleware.ts       # JWT + tenant injection
│   │   ├── rate-limit.middleware.ts # 5 rate limit strategies
│   │   ├── logger.middleware.ts     # Morgan + custom
│   │   └── index.ts
│   │
│   ├── controllers/                 # Business logic (TODO)
│   │   ├── leads.controller.ts
│   │   ├── sessions.controller.ts
│   │   ├── tenants.controller.ts
│   │   └── index.ts
│   │
│   ├── services/                    # External service integrations
│   │   ├── database.service.ts      # Prisma (TODO)
│   │   ├── waha.service.ts          # WhatsApp API (TODO)
│   │   ├── stripe.service.ts        # Stripe integration (TODO)
│   │   ├── sheets.service.ts        # Google Sheets (TODO)
│   │   └── index.ts
│   │
│   ├── types/                       # TypeScript types
│   │   └── index.ts                 # 25+ interfaces
│   │
│   ├── config/                      # Configuration
│   │   ├── supabase.ts              # Supabase client
│   │   ├── stripe.ts                # Stripe client
│   │   └── index.ts
│   │
│   ├── utils/                       # Utilities
│   │   ├── csv.ts                   # CSV export
│   │   ├── responses.ts             # Response helpers
│   │   └── index.ts
│   │
│   └── index.ts                     # Main export
│
├── .env.example                     # Template de env vars
├── .gitignore
├── tsconfig.json
├── package.json
│
├── README.md                        # Documentação
├── INTEGRATION.md                   # Exemplos de uso
├── COMPLETION_SUMMARY.md            # Sumário
└── COMPLETION_CHECKLIST.md          # Checklist

node_modules/
dist/
```

## Padrões de Código

### Route Handler Pattern

```typescript
router.get('/', requireAuth, authenticatedLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const data = await controller.getFunction(req.tenantId!);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      success: false,
      error: { code: 'ERROR_CODE', message: 'Failed' }
    });
  }
});
```

### Middleware Pattern

```typescript
export async function customMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    // Logic
    next();
  } catch (error) {
    res.status(401).json({ success: false, error: { code: 'CODE', message: 'msg' } });
  }
}
```

### Response Pattern

```typescript
// Success
{ success: true, data: {...}, meta: { timestamp } }

// Error
{ success: false, error: { code: 'CODE', message: 'msg', details: {...} } }
```

## Autenticação Flow

```
Browser                              API Server
  │                                    │
  ├─ Login (Supabase)                 │
  │                                    │
  ├─ Recebe JWT Token                 │
  │   (stored em localStorage)         │
  │                                    │
  ├─ Faz request com token ────────────→
  │   Header: Authorization: Bearer X  │
  │                                    │
  │                   ←────────────────┤ Valida JWT
  │                                    │
  │                   ←────────────────┤ Extrai user ID
  │                                    │
  │                   ←────────────────┤ Busca tenant
  │                                    │
  │                   ←────────────────┤ Injetar em req
  │                                    │
  │                   ←────────────────┤ Processa request
  │                                    │
  │       Recebe response ←────────────┤
```

## Rate Limiting Strategy

```
Public Limiter (sem autenticação)
├─ 100 requests
├─ por IP address
├─ em 15 minutos

Authenticated Limiter (com JWT)
├─ 1000 requests
├─ por user ID
├─ em 15 minutos

Strict Limiter (login attempts)
├─ 5 attempts
├─ por IP address
├─ em 15 minutos
└─ skipSuccessfulRequests: true

Webhook Limiter (webhooks externos)
├─ 50 requests
├─ por IP address
├─ em 1 minuto

API Key Limiter (custom)
├─ Customizável por API key
├─ Em memória (Map)
├─ Com reset automático
```

## Error Handling Strategy

```
Erro Ocorre
     ↓
Try-Catch Captura
     ↓
Valida Tipo de Erro
     ├─ Validation Error → 400
     ├─ Auth Error → 401
     ├─ Permission Error → 403
     ├─ Not Found → 404
     ├─ Rate Limit → 429
     └─ Server Error → 500
     ↓
Formata Response
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": { /* optional */ }
  }
}
     ↓
Log (console + file)
     ↓
Send Response
```

## Database Integration (Future)

```
Apps/API
    ↓
Prisma Client
    ↓
Supabase PostgreSQL
    ├─ tenants
    ├─ leads
    ├─ sessions
    ├─ notifications
    ├─ google_sheets_config
    └─ stripe_customers
```

## External Integrations

```
FlowDesk API
├─ Supabase
│  ├─ JWT Verification
│  ├─ User Database
│  ├─ Lead Storage
│  └─ Realtime Updates
├─ Stripe
│  ├─ Checkout Sessions
│  ├─ Subscription Management
│  ├─ Webhook Events
│  └─ Customer Data
├─ WAHA (WhatsApp)
│  ├─ Session Management
│  ├─ QR Code Generation
│  ├─ Message Sending/Receiving
│  └─ Webhook Events
└─ Google Sheets
   ├─ OAuth 2.0
   ├─ Sheet API
   ├─ Lead Sync
   └─ Real-time Updates
```

## Performance Considerations

```
Request Handling
├─ Morgan logging (async)
├─ JWT verification (fast, cached by Supabase)
├─ Rate limit check (in-memory Map)
├─ Route handler (async/await)
├─ Database query (indexed columns)
└─ Response serialization (JSON)

Optimization Points
├─ Cache JWT token validation
├─ Use indexes in database (tenantId, userId)
├─ Pagination (limit max 100)
├─ Select only needed fields
└─ Connection pooling (Prisma)
```

## Deployment Architecture

```
GitHub Repository
    ↓
GitHub Actions (CI/CD)
    ├─ Lint & Type Check
    ├─ Run Tests
    └─ Build Docker Image
    ↓
Docker Registry
    ↓
Production Deployment
    ├─ Render / Railway / Vercel
    ├─ Environment Variables
    ├─ PostgreSQL Database
    ├─ Redis Cache (optional)
    └─ Monitoring (New Relic / DataDog)
```

---

**Versão**: 1.0
**Status**: Ready for implementation
**Next Phase**: Database integration with Prisma
