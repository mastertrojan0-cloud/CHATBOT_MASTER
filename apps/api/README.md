# 🚀 FlowDesk API

Servidor Express com rotas completas para o dashboard FlowDesk.

## 🏗️ Estrutura

```
src/
├── server.ts              # Entry point principal
├── routes/                # Rotas
│   ├── leads.routes.ts    # Leads CRUD + stats + export
│   ├── sessions.routes.ts # WhatsApp sessions
│   ├── tenants.routes.ts  # Tenants + billing
│   └── index.ts
├── middleware/            # Middlewares
│   ├── auth.middleware.ts       # JWT Supabase + tenant injection
│   ├── rate-limit.middleware.ts # Rate limiting por IP/user
│   ├── logger.middleware.ts     # Logging com Morgan + custom
│   └── index.ts
├── controllers/           # Business logic
│   ├── leads.controller.ts
│   ├── sessions.controller.ts
│   ├── tenants.controller.ts
│   └── index.ts
├── services/              # Serviços externos
├── types/                 # TypeScript interfaces
│   └── index.ts
├── config/                # Configurações
│   ├── supabase.ts
│   ├── stripe.ts
│   └── index.ts
├── utils/                 # Utilitários
│   ├── csv.ts
│   ├── responses.ts
│   └── index.ts
└── index.ts
```

## 🛠️ Dependências

- `express` - Servidor HTTP
- `cors` - CORS handling
- `morgan` - Request logging
- `express-rate-limit` - Rate limiting
- `@supabase/supabase-js` - Autenticação e banco de dados
- `stripe` - Pagamentos
- `csv-stringifier` - Exportação CSV
- `axios` - HTTP client

## 📝 Rotas Principais

### Leads
```
GET    /api/leads                 # Listar com paginação
GET    /api/leads/stats           # Métricas dashboard
GET    /api/leads/leads-by-day    # Leads por dia
GET    /api/leads/top-interests   # Principais interesses
PATCH  /api/leads/:id             # Atualizar status
DELETE /api/leads/:id             # Deletar lead
GET    /api/leads/export/csv      # Exportar CSV (Pro)
```

### Sessions (WhatsApp)
```
GET    /api/sessions/current      # Status sessão atual
POST   /api/sessions/connect      # Iniciar conexão
GET    /api/sessions/qr           # QR code
GET    /api/sessions/status       # Health check
POST   /api/sessions/disconnect   # Desconectar
```

### Tenants
```
GET    /api/tenants/me            # Dados tenant
PATCH  /api/tenants/me            # Atualizar tenant
GET    /api/tenants/me/notifications      # Notificações (Pro)
PATCH  /api/tenants/me/notifications      # Atualizar notificações (Pro)
POST   /api/tenants/me/google-sheets      # Conectar Sheets (Pro)
GET    /api/tenants/me/google-sheets      # Config Sheets (Pro)
POST   /api/tenants/me/upgrade    # Upgrade para Pro (Stripe)
POST   /api/tenants/me/cancel-subscription # Cancelar subscription
```

### Webhooks
```
POST   /api/webhooks/stripe       # Stripe events
POST   /api/webhooks/waha         # WhatsApp events
```

## 🔐 Autenticação

Usa JWT do Supabase. Formato:
```
Authorization: Bearer <supabase_jwt_token>
```

Middleware `authMiddleware` valida e injeta:
- `req.user` - Usuário autenticado
- `req.tenantId` - ID do tenant

## ⚠️ Rate Limiting

- **Public**: 100 req/15min por IP
- **Webhook**: 50 req/min por IP
- **Authenticated**: 1000 req/15min por user
- **Strict** (login): 5 req/15min por IP

## 🚀 Iniciar

### Desenvolvimento
```bash
cd apps/api
yarn install
yarn dev
```

### Produção
```bash
yarn build
yarn start
```

### Variáveis de Ambiente
Crie `.env`:
```env
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=xxx

STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_YEARLY_PRICE_ID=price_yyy

WAHA_API_URL=http://waha-api:3000
```

## 📋 Implementação

### TODO:
- [ ] Integrar Prisma/TypeORM para banco de dados
- [ ] Conectar Supabase Realtime para atualizações ao vivo
- [ ] Implementar WAHA API para WhatsApp
- [ ] Webhooks do Stripe (pagamentos)
- [ ] Google Sheets API (sync de leads)
- [ ] Testes com Jest
- [ ] Documentação OpenAPI/Swagger

## 🔗 Integrações

### Supabase
- Autenticação JWT
- Database (leads, tenants, sessions)
- Realtime updates

### WAHA (WhatsApp HTTP API)
- Iniciar sessão (QR code)
- Receber mensagens (webhook)
- Enviar mensagens

### Stripe
- Checkout session
- Subscription management
- Webhooks

### Google Sheets
- OAuth 2.0
- Sync de leads

## 📊 Logging

- Morgan para HTTP requests
- Custom logger com duração
- Error logger para exceções
- Request ID em todos os logs

Exemplo de log:
```
[200] GET /api/leads - 123ms - user: abc123
[500] PATCH /api/leads/123 - 456ms - error: Not found
```

## 🐛 Error Handling

Respostas padronizadas:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

Códigos de erro:
- `NO_AUTH_TOKEN` - 401
- `INVALID_TOKEN` - 401
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `RATE_LIMIT_EXCEEDED` - 429
- `INTERNAL_ERROR` - 500

## 📞 Support

Para implementações específicas, consulte:
- Tipos em `src/types/index.ts`
- Controllers em `src/controllers/`
- Middlewares em `src/middleware/`
