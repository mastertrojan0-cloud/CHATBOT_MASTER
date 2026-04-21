# Deploy Remoto

## Objetivo

Fazer o FlowDesk funcionar a partir do GitHub, sem depender de build manual na maquina local.

## Arquitetura

- Repositorio GitHub: fonte unica de verdade
- GitHub Actions: CI e disparo de deploy
- Railway: API Node/Express
- Vercel: dashboard Vite/React
- WAHA: provedor de sessao WhatsApp consumido pela API

## Fluxo

1. Desenvolver em branch local ou diretamente em `main`.
2. Executar push para o GitHub.
3. Workflow `CI` valida build e publica a API na Railway quando o push e em `main`.
4. Workflow `Deploy Dashboard` publica o frontend na Vercel quando arquivos do dashboard mudam em `main`.
5. Ambos os workflows executam verificacao basica por HTTP apos o deploy.

## Secrets GitHub Necessarios

- `RAILWAY_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Variaveis da API na Railway

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SUPABASE_JWT_SECRET`
- `JWT_SECRET`
- `FRONTEND_URL`
- `WAHA_URL` ou `WAHA_BASE_URL`
- `WAHA_TOKEN` ou `WAHA_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRO_PRICE_ID`
- `RESEND_API_KEY`
- `RESEND_FROM`

## Endpoints de Verificacao

- API health: `https://flowdesk-api-production-e03a.up.railway.app/health`
- API health JSON: `https://flowdesk-api-production-e03a.up.railway.app/api/health`
- Dashboard: `https://chatbot-master-dashboard.vercel.app/`
- Dashboard connect: `https://chatbot-master-dashboard.vercel.app/connect`

## Regras Operacionais

- Nao depender de `yarn build` local para colocar mudancas em producao.
- Nao editar producao manualmente na Railway ou na Vercel quando a mudanca puder vir do GitHub.
- Usar a maquina local apenas para desenvolvimento, debug e validacao antes do push.
- Se a API subir mas o dashboard nao refletir a mudanca, verificar cache e o workflow de deploy do dashboard.
- Se o dashboard subir mas a API nao responder aos novos endpoints, verificar o workflow `CI` e os logs da Railway.
