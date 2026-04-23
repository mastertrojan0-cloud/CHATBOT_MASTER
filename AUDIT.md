# AUDIT - FlowDesk

## Resumo executivo
- Data da auditoria: 23/04/2026
- Commit base (antes): `34358169438db2d2cd9c28070198734bb06f33b7`
- Commit apos correcoes: `N/A (nao commitado neste ambiente)`

## Escopo e evidencias
- Estrutura mapeada: `apps/api/src`, `apps/dashboard/src`, `packages/engine/src`, `packages/db/prisma`
- Banco (Prisma):
  - `yarn workspace @flowdesk/db prisma validate` -> **OK**
  - `yarn workspace @flowdesk/db prisma migrate status` -> **falhou** com `Schema engine error`
- Railway vars: `railway variables` -> **nao executado** (CLI sem autenticacao: `railway login` necessario)
- Dependencias:
  - `yarn workspaces info` -> workspaces consistentes
  - `yarn outdated` -> varios pacotes com major/minor pendente
  - `yarn audit --level moderate` -> 1 vulnerabilidade moderada (`uuid` via `node-cron`)

## Fase 1 - Reconhecimento
### 1.1 Estrutura real (resumo)
- API (`apps/api/src`):
  - `routes/`: `auth`, `leads`, `metrics`, `sessions`, `tenants`
  - `webhooks/`: `waha`, `stripe`, `telegram`
  - `middleware/`: auth, validate, rate-limit, logger
  - `controllers/`: `leads` (ativo), `sessions` (nao referenciado), `tenants` (nao referenciado)
- Dashboard (`apps/dashboard/src`):
  - app principal em `App.tsx` (React Router)
  - paginas: dashboard, leads, connect, settings, login, register
  - hooks/stores ativos para auth, queries/mutations
  - `AppLayout.tsx` e `config/router.tsx` (TanStack Router) **nao referenciados**
- Engine (`packages/engine/src`): `engine.ts`, `flows.ts`, `index.ts`
- Prisma (`packages/db/prisma`): `schema.prisma`

### 1.1 Dead code / sobreposicao / TODO-FIXME
- Dead code confirmado:
  - `apps/api/src/controllers/sessions.controller.ts`
  - `apps/api/src/controllers/tenants.controller.ts`
  - `apps/dashboard/src/AppLayout.tsx`
  - `apps/dashboard/src/config/router.tsx`
  - `apps/api/src/utils/responses.ts` (nao referenciado)
- Sobreposicao de responsabilidade:
  - `apps/api/src/routes/leads.routes.ts` possui `/top-interests` mock
  - `apps/api/src/routes/metrics.routes.ts` possui `/top-interests` real
- TODO/FIXME pendentes: encontrados em controllers e rotas (`sessions`, `tenants`, `leads`)

### 1.2 Banco
- `validate`: schema valido
- `migrate status`: falha de engine (sem detalhe adicional no CLI)
- Divergencia schema x banco: **nao confirmavel** enquanto `migrate status` falha

### 1.3 Variaveis de ambiente
- Nao foi possivel listar variaveis reais do Railway por falta de autenticacao do CLI
- Inconsistencia real encontrada no codigo/exemplo:
  - codigo exigia `SUPABASE_SERVICE_KEY`
  - `.env.example` so trazia `SUPABASE_SERVICE_ROLE_KEY`
  - `JWT_SECRET` era requerido no boot e ausente no `.env.example`

### 1.4 Dependencias
- Vulnerabilidade confirmada por audit:
  - `uuid` (moderate) em cadeia `@flowdesk/api > node-cron > uuid`
  - advisory: `https://www.npmjs.com/advisories/1116970`
- Majors defasadas relevantes (sem upgrade nesta auditoria): Prisma 5->7, Stripe 14->22, Express 4->5, Vite 5->8

## Fase 2 - Auditoria funcional
### 2.1 Teste de endpoints da API (producao)
Output executado:

```text
=== TESTE DE ENDPOINTS ===
GET /health -> 200
POST /api/auth/login -> 200 token_ok
GET /api/tenants/me -> 200
GET /api/leads?page=1&limit=10 -> 200
GET /api/metrics -> 200
GET /api/metrics/leads-by-day -> 200
GET /api/metrics/top-interests -> 200
GET /api/sessions/current -> 200
GET /api/sessions/status -> 200

=== TESTE DE SEGURANCA ===
SEM TOKEN /api/leads -> 401 OK
VALIDACAO invalida -> 400 OK

=== TESTE RATE LIMIT (12 logins rapidos) ===
401 401 401 401 401 401 401 401 401 401 401 401
(Esperado: ao menos um 429 apos 10 tentativas)
```

### 2.2 Isolamento de tenant (grep e revisao)
- Analise realizada em `routes`, `controllers` e `webhooks`
- Achado critico confirmado:
  - `apps/api/src/controllers/leads.controller.ts`: `update`/`delete` usando `where: { id, tenantId }` em modelo sem unique composto (quebra funcional e risco de bypass por implementacao incorreta)
- Achados adicionais:
  - `apps/api/src/webhooks/waha.webhook.ts` usava sessao hardcoded `default` em envio/restart, causando risco de comportamento cruzado em multi-tenant/multi-session

### 2.3 Fluxo WAHA (producao)
Output executado:

```text
/api/server/status -> 200
/api/sessions -> 200
/api/version -> 200
```

### 2.4 Webhooks
- `waha.webhook.ts`:
  - resposta 200 imediata (bom para evitar retry infinito)
  - faltava validacao de shape do payload (corrigido)
  - havia uso de sessao hardcoded em envio/restart (corrigido)
- `stripe.webhook.ts`:
  - verificacao de assinatura presente
  - faltava idempotencia explicita de evento (corrigido com cache TTL em memoria)
  - invalicao de cache de tenant faltava em alguns eventos (corrigido)

## Problemas encontrados
| ID | Severidade | Categoria | Arquivo | Descricao | Status |
|---|---|---|---|---|---|
| A-001 | Critica | Seguranca/Isolamento | `apps/api/src/webhooks/waha.webhook.ts` | Sessao WAHA hardcoded (`default`) em envio/restart | corrigido |
| A-002 | Critica | Integridade tenant | `apps/api/src/controllers/leads.controller.ts` | `update/delete` com `where` inconsistente para ownership por tenant | corrigido |
| A-003 | Alta | Webhook | `apps/api/src/webhooks/waha.webhook.ts` | Sem validacao de shape do payload de entrada | corrigido |
| A-004 | Alta | Webhook/Billing | `apps/api/src/webhooks/stripe.webhook.ts` | Sem idempotencia explicita para eventos repetidos | corrigido |
| A-005 | Media | Cache/Billing | `apps/api/src/webhooks/stripe.webhook.ts` | Invalicao de cache ausente em parte dos eventos | corrigido |
| A-006 | Media | Configuracao | `apps/api/src/config/env.ts`, `.env.example`, `apps/api/src/config/supabase.ts` | Drift entre `SUPABASE_SERVICE_KEY` vs `SUPABASE_SERVICE_ROLE_KEY`; `JWT_SECRET` ausente no exemplo | corrigido |
| A-007 | Media | Operacao | `packages/db/prisma` | `prisma migrate status` falha com `Schema engine error` | pendente |
| A-008 | Media | Seguranca | `apps/api/src/routes/auth.routes.ts` / infra | Rate limit de login em producao sem `429` no teste rapido | pendente |
| A-009 | Baixa | Qualidade | `apps/api/src/controllers/*`, `apps/dashboard/src/*` | Dead code e rotas duplicadas (`top-interests`) | pendente |
| A-010 | Media | Dependencias | lockfile/workspaces | `uuid` vulneravel via `node-cron` | pendente |

## Correcoes aplicadas
- `apps/api/src/controllers/leads.controller.ts`
  - Troca de `lead.update/delete` por `updateMany/deleteMany` com filtro `id + tenantId`
  - Leitura pos-update via `findFirst` para retorno consistente
  - Justificativa: garantir ownership por tenant sem depender de unique composta inexistente
- `apps/api/src/webhooks/waha.webhook.ts`
  - Inclusao de validacao de shape (`isValidWebhookBody`)
  - Substituicao de sessao hardcoded `default` por `sessionName` do webhook
  - Justificativa: evitar cross-tenant em sessao compartilhada e robustez de input
- `apps/api/src/webhooks/stripe.webhook.ts`
  - Inclusao de idempotencia basica por `event.id` com TTL em memoria
  - Rejeicao explicita quando `STRIPE_WEBHOOK_SECRET` ausente
  - Invalicao de cache em eventos adicionais (`invoice.payment_failed`, `customer.subscription.updated`)
  - Justificativa: reduzir efeitos de retries duplicados e cache stale de plano
- `apps/api/src/config/env.ts`
  - Aceita `SUPABASE_SERVICE_KEY` **ou** `SUPABASE_SERVICE_ROLE_KEY` como requisito
- `apps/api/src/config/supabase.ts`
  - Fallback de chave para `SUPABASE_SERVICE_ROLE_KEY`
- `.env.example`
  - Inclusao de `JWT_SECRET` e `SUPABASE_SERVICE_KEY`

## Validacao final executada
- `npx tsc -p apps/api/tsconfig.json --noEmit` -> OK
- `npx tsc -p apps/dashboard/tsconfig.json --noEmit` -> OK
- `yarn workspace @flowdesk/dashboard build` -> OK
- Reexecucao dos testes de endpoint em producao -> endpoints criticos responderam corretamente; rate-limit continuou sem `429`

## Pendencias para proximo sprint (priorizado)
1. Implementar rate-limit distribuido para login (Redis/Upstash ou store compartilhada) e revalidar `429` sob replicas.
2. Corrigir `prisma migrate status` em ambiente Supabase pooler (validar `DIRECT_URL` e conectividade do schema engine).
3. Remover dead code e unificar endpoint de top interests (`/api/leads/top-interests` vs `/api/metrics/top-interests`).
4. Atualizar cadeia `node-cron/uuid` para remover advisory moderada.

## Score de qualidade (0 a 10)
- Seguranca: 8/10
- Estabilidade: 7/10
- Performance: 7/10
- Cobertura de erros: 8/10
- Qualidade de codigo: 7/10
- Score geral: 7.4/10

## Recomendacoes
- Priorizar hardening operacional (rate-limit distribuido + observabilidade por tenant/session).
- Fechar debt de ambiente/migrations antes de novas features de billing e automacao.
- Consolidar contratos de API e remover endpoints duplicados/mocks remanescentes para reduzir ambiguidade.
