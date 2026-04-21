# FlowDesk

WhatsApp Chatbot SaaS for Businesses

Monorepo Node.js + TypeScript com Yarn Workspaces.

## Deploy via GitHub

O fluxo recomendado e 100% remoto, sem depender da maquina local:

1. Commit e push na branch `main`.
2. O GitHub Actions executa typecheck e build do monorepo.
3. A API e publicada na Railway pelo workflow [ci.yml](./.github/workflows/ci.yml).
4. O dashboard e publicado na Vercel pelo workflow [deploy-dashboard.yml](./.github/workflows/deploy-dashboard.yml).
5. Os workflows fazem uma verificacao simples de saude apos o deploy.

## Secrets do GitHub

Configure estes secrets no repositório:

- `RAILWAY_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Variaveis de Producao

Configure na Railway, no servico da API:

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

O dashboard publicado na Vercel usa rewrite para a API publicada em Railway.

## Operacao

- Desenvolvimento local: opcional, apenas para implementar e testar mudancas.
- Producao: sempre via `git push` para `main`.
- Se um deploy falhar, verifique primeiro a aba Actions do GitHub e depois os logs da Railway/Vercel.
