# 📚 API Integration Guide

Este guia descreve como usar os endpoints da API FlowDesk.

## Autenticação

Todos os endpoints (exceto webhooks) requerem um token JWT do Supabase no header:

```bash
Authorization: Bearer <seu_token_jwt>
```

Como obter o token:
1. Faça login no seu aplicativo React
2. O token é armazenado automaticamente no localStorage
3. Envie no header Authorization

## Exemplos de Requisições

### Listar Leads

```bash
curl -H "Authorization: Bearer token" \
  "http://localhost:3000/api/leads?page=1&limit=10&status=interested"
```

**Parâmetros**:
- `page`: número da página (default: 1)
- `limit`: resultados por página (max: 100, default: 10)
- `search`: buscar por nome, telefone ou email
- `status`: filtrar por status (new, contacted, interested, qualified, lost)
- `scoreMin`: score mínimo (0-100)
- `scoreMax`: score máximo (0-100)
- `interestIn`: array de interesses (ex: ?interestIn=Produto%20A&interestIn=Produto%20B)

**Resposta**:
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "lead-1",
        "name": "João Silva",
        "phone": "11987654321",
        "email": "joao@example.com",
        "status": "interested",
        "score": 85,
        "interests": ["Produto A"],
        "messages": 3,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 47,
      "pages": 5
    }
  }
}
```

### Obter Métricas do Dashboard

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/leads/stats
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "leadsToday": 5,
    "leadsThisMonth": 47,
    "messagesThisMonth": 203,
    "contactsToday": 3,
    "conversionRate": 0.15,
    "avgResponseTime": 300,
    "recentLeads": [...]
  }
}
```

### Atualizar Status de Lead

```bash
curl -X PATCH \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"status": "qualified", "score": 90}' \
  http://localhost:3000/api/leads/lead-123
```

### Exportar Leads em CSV (Pro Only)

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/leads/export/csv \
  -o leads.csv
```

### Obter Status WhatsApp

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/sessions/current
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "id": "session-1",
    "state": "CONNECTED",
    "phoneNumber": "5511987654321",
    "connectedAt": "2024-01-15T10:30:00Z"
  }
}
```

### Iniciar Conexão WhatsApp

```bash
curl -X POST \
  -H "Authorization: Bearer token" \
  http://localhost:3000/api/sessions/connect
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "state": "SCAN_QR_CODE",
    "qr": "data:image/png;base64,iVBORw0KGgo..."
  }
}
```

### Obter QR Code (para polling)

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/sessions/qr
```

### Atualizar Dados do Tenant

```bash
curl -X PATCH \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Minha Empresa LTDA",
    "industry": "Tech",
    "phone": "11987654321",
    "email": "contact@empresa.com",
    "website": "https://empresa.com"
  }' \
  http://localhost:3000/api/tenants/me
```

### Obter Configurações de Notificações (Pro)

```bash
curl -H "Authorization: Bearer token" \
  http://localhost:3000/api/tenants/me/notifications
```

### Atualizar Notificações (Pro)

```bash
curl -X PATCH \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{
    "waNotifications": true,
    "emailNotifications": false,
    "newLeadAlert": true,
    "messageAlert": true
  }' \
  http://localhost:3000/api/tenants/me/notifications
```

### Criar Sessão de Checkout (Upgrade Pro)

```bash
curl -X POST \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"priceId": "price_xxx"}' \
  http://localhost:3000/api/tenants/me/upgrade
```

**Resposta**:
```json
{
  "success": true,
  "data": {
    "sessionId": "cs_test_xxx",
    "url": "https://checkout.stripe.com/pay/cs_test_xxx",
    "expiresAt": "2024-01-16T10:30:00Z"
  }
}
```

## Códigos de Erro

| Código | HTTP | Descrição |
|--------|------|-----------|
| `NO_AUTH_TOKEN` | 401 | Token não fornecido |
| `INVALID_TOKEN` | 401 | Token inválido ou expirado |
| `UNAUTHORIZED` | 401 | Não autorizado |
| `FORBIDDEN` | 403 | Acesso proibido (requer Pro) |
| `NOT_FOUND` | 404 | Recurso não encontrado |
| `RATE_LIMIT_EXCEEDED` | 429 | Limite de requisições atingido |
| `INTERNAL_ERROR` | 500 | Erro do servidor |

## Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| Public | 100 req | 15 min |
| Authenticated | 1000 req | 15 min |
| Webhooks | 50 req | 1 min |

Se atingir o limite, receba:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  }
}
```

## Campos de Lead

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID único |
| `tenantId` | string | ID do tenant |
| `name` | string | Nome do lead |
| `phone` | string | Telefone (11987654321) |
| `email` | string | Email (opcional) |
| `status` | enum | new, contacted, interested, qualified, lost |
| `score` | number | 0-100 |
| `interests` | array | Produtos/serviços de interesse |
| `messages` | number | Total de mensagens trocadas |
| `createdAt` | ISO8601 | Data de criação |
| `updatedAt` | ISO8601 | Última atualização |

## Webhooks

### Stripe
`POST /api/webhooks/stripe`

Eventos suportados:
- `payment_intent.succeeded`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### WhatsApp (WAHA)
`POST /api/webhooks/waha`

Eventos suportados:
- `message` - Nova mensagem recebida
- `status.ack` - Confirmação de mensagem
- `error` - Erro na sessão

## Próximos Passos

1. **Testar endpoints**: Use Postman ou curl
2. **Verificar Rate Limiting**: Tente enviar muitas requisições
3. **Configurar webhooks**: Setup do Stripe e WAHA
4. **Implementar business logic**: Adicionar lógica nos controllers
5. **Conectar banco de dados**: Integrar Prisma/TypeORM

## Suporte

Problemas? Consulte:
- `/api/health` - Status da API
- Logs em `./logs/`
- Erros estruturados em `src/types/index.ts`
