# 🚀 Quick Start Guide

Guia rápido para iniciar a API e testar os endpoints.

## 1. Setup Inicial (5 minutos)

### Pré-requisitos
- Node.js 18+ instalado
- Yarn instalado
- Supabase account (para JWT)

### Instalação

```bash
# Ir para o diretório da API
cd apps/api

# Instalar dependências
yarn install

# Criar arquivo .env
cp .env.example .env.local

# Editar .env.local com suas credenciais
# Minimamente precisa:
#   - SUPABASE_URL
#   - SUPABASE_SERVICE_KEY
```

### Iniciar Servidor

```bash
# Dev mode (hot reload)
yarn dev

# Ou produção
yarn build
yarn start
```

Você deve ver:
```
╔════════════════════════════════════════╗
║      FlowDesk API Server Started       ║
╠════════════════════════════════════════╣
║ Port:     3000                         ║
║ Env:      development                  ║
║ Frontend: http://localhost:5173        ║
╚════════════════════════════════════════╝
```

## 2. Testar Endpoints (curl)

### Health Check

```bash
# Sem autenticação
curl http://localhost:3000/health

# Ou com /api
curl http://localhost:3000/api/health

# Resposta esperada:
# { "success": true, "message": "API is healthy" }
```

### Listar Leads

```bash
# Precisa de JWT token válido
JWT_TOKEN="seu_token_aqui"

curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:3000/api/leads?page=1&limit=10"

# Com filtros
curl -H "Authorization: Bearer $JWT_TOKEN" \
  "http://localhost:3000/api/leads?status=interested&scoreMin=80"
```

### Atualizar Lead

```bash
curl -X PATCH \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"qualified","score":95}' \
  http://localhost:3000/api/leads/lead-123
```

### WhatsApp Status

```bash
curl -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/sessions/current
```

### Iniciar Conexão WhatsApp

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  http://localhost:3000/api/sessions/connect
```

### Upgrade para Pro (Stripe)

```bash
curl -X POST \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_xxx"}' \
  http://localhost:3000/api/tenants/me/upgrade

# Resposta:
# { "success": true, "data": { "sessionId": "...", "url": "..." } }
```

## 3. Obter JWT Token

### Opção 1: Via Frontend React

1. Faça login no seu app React (localhost:5173)
2. Abra DevTools → Console
3. Execute:
```javascript
// Supabase armazena o token
const token = (await supabaseClient.auth.getSession()).data.session.access_token;
console.log(token);
```

### Opção 2: Via Supabase API

```bash
curl -X POST https://seu-project.supabase.co/auth/v1/token?grant_type=password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu@email.com",
    "password": "senha",
    "gotrue_meta_security": {}
  }' | jq '.access_token'
```

### Opção 3: Usar Token de Teste

Para desenvolvimento, você pode:
1. Gerar JWT manualmente com https://jwt.io
2. Use o formato:
```json
{
  "aud": "authenticated",
  "sub": "user-id-aqui",
  "email": "test@example.com"
}
```

## 4. Testar com Postman

### Importar Collection

1. Abra Postman
2. Create → Request
3. Método: GET
4. URL: `http://localhost:3000/api/health`
5. Send

### Configurar Auth

Para cada request:
1. Tab "Authorization"
2. Type: Bearer Token
3. Token: `seu_jwt_token`

### Exemplos de Requests

```
GET http://localhost:3000/api/leads
GET http://localhost:3000/api/leads/stats
PATCH http://localhost:3000/api/leads/:id
DELETE http://localhost:3000/api/leads/:id
GET http://localhost:3000/api/leads/export/csv

GET http://localhost:3000/api/sessions/current
POST http://localhost:3000/api/sessions/connect
GET http://localhost:3000/api/sessions/qr

GET http://localhost:3000/api/tenants/me
PATCH http://localhost:3000/api/tenants/me
POST http://localhost:3000/api/tenants/me/upgrade
```

## 5. Debugging

### Logs

```bash
# Dev mode mostra logs em tempo real
# Procure por patterns:
# [200] GET /api/leads - 45ms
# [401] GET /api/sessions/current - UNAUTHORIZED
# [500] PATCH /api/leads/:id - ERROR
```

### Verificar Environment

```bash
# Dentro de src/server.ts ou outro arquivo
console.log(process.env.NODE_ENV);
console.log(process.env.PORT);
console.log(process.env.SUPABASE_URL);
```

### Rate Limiting

```bash
# Fazer 100+ requests em 15 minutos para testar
for i in {1..105}; do
  curl http://localhost:3000/api/health
  echo "Request $i"
  sleep 1
done

# Depois do 100º request, deve retornar 429 Too Many Requests
```

### Mock Data

Todos os endpoints retornam mock data. Para usar dados reais:
1. Implementar controllers
2. Conectar Prisma
3. Trocar mock por queries

## 6. Estrutura de Resposta

### Sucesso (200)
```json
{
  "success": true,
  "data": {
    "id": "lead-1",
    "name": "João",
    ...
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Erro (4xx/5xx)
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Lead not found",
    "details": {}
  }
}
```

### Paginação
```json
{
  "success": true,
  "data": {
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 47,
      "pages": 5
    }
  }
}
```

## 7. Checklist de Desenvolvimento

- [ ] Criar `.env.local` com credenciais
- [ ] `yarn install` em apps/api
- [ ] `yarn dev` - servidor rodando
- [ ] `curl http://localhost:3000/health` - OK
- [ ] Testar GET /api/leads com JWT
- [ ] Testar PATCH lead status
- [ ] Testar GET sessions/current
- [ ] Verificar logs em console
- [ ] Testar rate limiting
- [ ] Próximo: Implementar Prisma

## 8. Próximos Passos

### Curto Prazo
1. [ ] Instalar Prisma: `yarn add prisma @prisma/client`
2. [ ] Criar schema.prisma
3. [ ] Implementar database queries
4. [ ] Trocar mock data por real queries

### Médio Prazo
1. [ ] Conectar Stripe webhooks
2. [ ] Integrar WAHA API
3. [ ] Setup Google Sheets OAuth
4. [ ] Adicionar input validation

### Longo Prazo
1. [ ] Testes (Jest + supertest)
2. [ ] Docker setup
3. [ ] CI/CD (GitHub Actions)
4. [ ] Monitoring (Datadog/New Relic)
5. [ ] Deploy (Render/Railway)

## 📚 Documentação Adicional

- [INTEGRATION.md](./INTEGRATION.md) - Detalhes dos endpoints
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Visão geral da arquitetura
- [README.md](./README.md) - Overview geral
- [COMPLETION_CHECKLIST.md](./COMPLETION_CHECKLIST.md) - Progress tracking

## 🆘 Troubleshooting

### Porta já em uso
```bash
# Mudar em .env
PORT=3001
```

### JWT inválido
```
Error: INVALID_TOKEN
```
Solução: Gere um novo JWT ou use token do Supabase válido

### CORS error
```
Error: Cross-Origin Request Blocked
```
Solução: Configure FRONTEND_URL em .env corretamente

### Rate limited
```
Error: Too many requests (429)
```
Solução: Espere 15 minutos ou reinicie o servidor

---

**Time**: ~5-10 minutos para setup + testes
**Status**: Ready to go! 🚀
