# AUDITORIA TECNICA COMPLETA - FlowDesk MVP

Data: 2026-04-20
Escopo: monorepo (apps/api, apps/dashboard, packages/engine, packages/db)

## 1) Schema e Banco

### 1.1 Integridade do Prisma schema
- Arquivo analisado: packages/db/prisma/schema.prisma
- Modelos com `@id`: OK (Tenant, TenantUser, Flow, Contact, Conversation, Message, Lead).
- Relacionamentos com `onDelete`: OK em todas as relacoes declaradas no schema.
- Campos obrigatorios sem default com risco de crash em `create`:
  - `Tenant.businessSegment`, `Tenant.wahaSessionName`, `Flow.definition`, `Contact.whatsappPhone`, `Contact.whatsappPhoneE164`, `Message.direction`, `Lead.contactId`.
  - Risco mitigado apenas se sempre preenchidos na API.
- Enums: ha divergencia no endpoint de patch de lead (usa valores fora do enum Prisma).
  - Referencia: apps/api/src/routes/leads.routes.ts:331
- Indices em campos consultados (`tenantId`, `createdAt`): OK para Lead/Message/Conversation e outros modelos multi-tenant.

### 1.2 Migrations
Comandos executados:
- `yarn workspace @flowdesk/db prisma migrate status`
- `yarn workspace @flowdesk/db prisma migrate deploy`

Resultado:
- Falha de status/deploy por ausencia de historico de migrations para um banco ja populado (baseline nao criado).
- Estado atual: schema do banco NAO esta gerenciado por Prisma Migrate.
- Impacto: alto risco de drift entre schema esperado e schema real em producao.

### 1.3 Campos no schema nao refletidos na API
Campos/modelos com baixa ou nenhuma exposicao em respostas:
- Modelo Tenant: `wahaApiKey`, `wahaInstanceId`, `stripeSubscriptionId`, `stripePriceId`, `paymentFailedCount`.
- Modelos sem endpoints de leitura dedicados: `Flow`, `Conversation`, `Message`.
- Parte de Contact/Lead avancado (automacao) nao aparece em payloads de dashboard/metrics.

Diagnostico:
- Indica features incompletas ou ainda nao integradas ao dashboard.

## 2) Auditoria da API

### 2.1 Rotas registradas e middleware
Arquivo analisado: apps/api/src/server.ts

Rotas publicas:
- `/health`, `/api/health`
- `/api/webhooks/stripe`
- `/api/webhooks/waha/:sessionName`
- `/api/auth/*`

Rotas protegidas por `authMiddleware` global em `/api/*`:
- `/api/leads/*`, `/api/sessions/*`, `/api/tenants/*`, `/api/metrics/*`, `/api/auth/logout`

Sem autenticacao e que deveriam ter autenticacao:
- Nenhuma adicional encontrada alem das publicas esperadas.

Sem validacao Zod:
- Apenas `auth/login` e `auth/register` usam `validate(zod)`.
- Leads, tenants, sessions, metrics e webhook processam input sem schema Zod.

### 2.2 Controllers e handlers
Achados principais:
- CRITICO: isolamento de tenant fragil no auth.
  - `findFirst` por email escolhe o primeiro tenant ativo, podendo associar usuario ao tenant errado quando mesmo email existir em mais de um tenant.
  - Referencia: apps/api/src/middleware/auth.middleware.ts:62
- ALTO: validacao de status de lead incompativel com enum Prisma.
  - Endpoint aceita `new/contacted/interested/qualified/lost`, mas enum do banco e `NEW/QUALIFIED/NURTURING/WON/LOST/DISQUALIFIED`.
  - Referencia: apps/api/src/routes/leads.routes.ts:331
- ALTO: webhook WAHA grava mensagens com `conversationId` potencialmente `undefined`.
  - Pode quebrar persistencia de mensagens para conversas novas.
  - Referencias: apps/api/src/webhooks/waha.webhook.ts:159, apps/api/src/webhooks/waha.webhook.ts:238, apps/api/src/webhooks/waha.webhook.ts:250
- MEDIO: exposicao desnecessaria de identificador de billing no tenant payload.
  - `stripeCustomerId` retornado em `/api/tenants/me`.
  - Referencia: apps/api/src/routes/tenants.routes.ts:58

Sobre logs sensiveis:
- Nao foi encontrado log explicito de senha em texto puro.
- Existem varios `console.error`, sem mascaramento estruturado.

### 2.3 Webhook WAHA
Arquivo: apps/api/src/webhooks/waha.webhook.ts

Verificacao:
- Responde `200` imediatamente: OK.
- Validacao de payload: insuficiente (nao ha schema zod/joi; assume estrutura de `body.payload`).
- Evento malformado: nao derruba processo (try/catch), mas pode falhar silenciosamente.
- Validacao de tenant antes de processar: parcial (busca por `wahaSessionName`), sem assinatura/secreto do provedor.

### 2.4 Variaveis de ambiente obrigatorias
Antes da correcao:
- Nao havia validacao central de startup para vars obrigatorias.

Correcao aplicada:
- Novo arquivo: apps/api/src/config/env.ts
- Importado no boot: apps/api/src/server.ts
- Vars obrigatorias validadas:
  - DATABASE_URL
  - SUPABASE_URL
  - SUPABASE_SERVICE_KEY
  - SUPABASE_JWT_SECRET
  - JWT_SECRET

### 2.5 Testes de endpoints criticos
Resultado do script ajustado:
- LOGIN: 200, token obtido.
- GET /api/tenants/me: 200
- GET /api/leads?page=1&limit=10: 200
- GET /api/leads/stats: 200
- GET /api/sessions/current: 200
- GET /api/metrics: 200
- GET /api/leads sem token: 401 (OK)
- GET /api/leads?tenantId=tenant-id-falso com token: 200

Nota sobre tenant injection:
- O retorno 200 nao prova vazamento por si so; a maior parte das queries usa `req.tenantId` no backend.
- Ainda existe risco critico no mapeamento de tenant por email (auth middleware).

## 3) Auditoria do Engine de Chatbot

Arquivos:
- packages/engine/src/engine.ts
- packages/engine/src/flows.ts

### 3.1 Verificacao geral
- Mensagem vazia: tratada (fallback de validacao nas etapas `menu/collect`).
- Emoji/caracter especial: nao houve crash nos testes.
- Persistencia de estado: depende de contexto externo; engine funciona se caller persistir `nextContext`.
- Timeout de banco: nao se aplica diretamente (engine e puro, sem IO).

Risco:
- Se `userMessage` vier `null/undefined` em runtime (fora do tipo TS), `trim()` pode quebrar.

### 3.2 Simulacao do fluxo de lead
Sequencia testada:
1. inicial -> menu de boas-vindas: OK
2. opcao invalida (`9`) -> fallback gracioso: OK
3. coleta de nome (`Joao`): OK
4. telefone invalido (`123`) -> fallback: OK
5. telefone valido (`11999998888`) -> lead parcial FREE completo: OK

Observacao:
- No plano FREE, fluxo fecha apos nome+telefone (por design de `isLeadComplete`).

## 4) Auditoria do Dashboard

### 4.1 TanStack Query
Arquivo: apps/dashboard/src/hooks/queries.ts

- Nem todas queries tem `staleTime` local.
- Polling agressivo em WAHA (`3s`) pode ser caro se mantido sempre ativo.
- 401 interceptor com logout existe no client API.
  - Referencia: apps/dashboard/src/config/api.ts:27

### 4.2 authStore
Arquivo: apps/dashboard/src/stores/authStore.ts

- Logout limpa `user`, `tenant`, `token`: OK.
- Expiracao por `expiresIn` nao e validada/localmente armazenada.
- Store considera token de sessionStorage sem validar validade JWT.
  - Referencia: apps/dashboard/src/stores/authStore.ts:22

### 4.3 App.tsx e rotas privadas
Arquivo: apps/dashboard/src/App.tsx

- Rotas privadas verificam apenas existencia de token.
- Token expirado depende de falha 401 para redirecionar.
- Rota fallback existe, mas redireciona sempre para `/dashboard` (nao pagina 404 dedicada).
  - Referencia: apps/dashboard/src/App.tsx:43

### 4.4 Build e typecheck
Comandos:
- `npx tsc -p apps/api/tsconfig.json --noEmit` -> OK
- `npx tsc -p apps/dashboard/tsconfig.json --noEmit` -> FALHOU (26 erros)
- `yarn workspace @flowdesk/dashboard build` -> OK (com warning de chunk grande)

Principais erros dashboard:
- Inconsistencia de tipos (`businessName`, `usage`, `waConnected`).
- Config TS/modulo com `import.meta` incompativel.
- Falta typings de `qrcode.react`.
- Override faltando em ErrorBoundary.

## 5) Auditoria de Seguranca

### 5.1 Headers de seguranca
Teste remoto em `/health`:
- `x-content-type-options`: AUSENTE
- `x-frame-options`: AUSENTE
- `strict-transport-security`: AUSENTE
- `x-xss-protection`: AUSENTE
- `content-security-policy`: AUSENTE

Correcao aplicada no codigo:
- `helmet` adicionado e registrado.
  - Referencia: apps/api/src/server.ts:48

### 5.2 Dados sensiveis expostos
- `/api/tenants/me` expoe `stripeCustomerId` (desnecessario para frontend na maioria dos cenarios).
- `/api/auth/login` nao expoe hash de senha: OK.
- `/api/leads` sem indicio direto de dados cross-tenant no handler principal.

### 5.3 Rate limiting global
Antes da correcao:
- Havia limiters por rota/middleware, sem limite global uniforme.

Correcao aplicada:
- Global limiter 100 req/min por IP inserido em server.
  - Referencia: apps/api/src/server.ts:85

## BUGS CRITICOS (pode parar sistema ou vazar dados)

1. apps/api/src/middleware/auth.middleware.ts:62
- Descricao: tenant e resolvido por `findFirst` usando apenas email.
- Impacto: risco de isolamento quebrado entre tenants (usuario autenticado cair no tenant errado).

2. apps/api/src/webhooks/waha.webhook.ts
- Descricao: webhook sem validacao de autenticidade/origem (assinatura/secreto).
- Impacto: risco de injecao de eventos externos e criacao indevida de leads/mensagens.

## BUGS ALTOS (funcionalidade quebrada ou seguranca comprometida)

1. apps/api/src/routes/leads.routes.ts:331
- Descricao: status aceitos no PATCH nao batem com enum Prisma.
- Impacto: atualizacao de lead inconsistente, erro funcional e dados invalidos.

2. apps/api/src/webhooks/waha.webhook.ts:159, 238, 250
- Descricao: `conversationId` pode ficar `undefined` ao criar mensagens.
- Impacto: perda de historico/mensagens e falhas silenciosas de persistencia.

3. Gestao de migrations sem baseline Prisma
- Descricao: `migrate status/deploy` falham (P3005).
- Impacto: risco de drift e deploys inseguros de schema.

## BUGS MEDIOS (experiencia degradada)

1. apps/api/src/routes/tenants.routes.ts:58
- Descricao: exposicao de `stripeCustomerId` no payload de tenant.
- Impacto: aumenta superficie de dados sensiveis no frontend.

2. apps/dashboard/src/**/* (multiplos arquivos)
- Descricao: 26 erros de typecheck em producao de codigo.
- Impacto: manutencao fragil e risco de regressao silenciosa.

3. apps/dashboard/src/App.tsx:43
- Descricao: fallback sem pagina 404 real.
- Impacto: UX confusa em rota invalida.

## MELHORIAS RECOMENDADAS

1. API
- Arquivo: apps/api/src/routes/*
- Melhoria: padronizar Zod em todas rotas de entrada.
- Beneficio: reduz erros de runtime e payload malformado.

2. Webhooks
- Arquivo: apps/api/src/webhooks/waha.webhook.ts
- Melhoria: validar schema + assinatura/HMAC.
- Beneficio: evita eventos forjados.

3. Dashboard
- Arquivo: apps/dashboard/src/hooks/queries.ts
- Melhoria: revisar polling e `staleTime` por criticidade.
- Beneficio: menor custo de rede e carga no backend.

4. Observabilidade
- Arquivo: apps/api/src/**/*
- Melhoria: substituir `console.*` por logger estruturado com redacao de campos sensiveis.
- Beneficio: auditoria e troubleshooting mais seguros.

## PLANO DE CORRECAO (Criticos e Altos)

1. Isolamento de tenant no auth
- Arquivo: apps/api/src/middleware/auth.middleware.ts
- Mudanca exata:
  - Nao usar `findFirst` por email.
  - Introduzir mapeamento estavel `supabaseUserId -> tenantUser` (coluna/relacao dedicada).
  - Bloquear ambiguidade: se mais de um tenant para mesmo email, retornar erro explicito.
- Validacao:
  - Teste com mesmo email em 2 tenants deve falhar com erro de ambiguidade ou resolver tenant correto por userId.

2. Autenticidade do webhook WAHA
- Arquivo: apps/api/src/webhooks/waha.webhook.ts
- Mudanca exata:
  - Verificar assinatura/header compartilhado antes de processar payload.
  - Rejeitar eventos sem assinatura valida.
- Validacao:
  - POST sem assinatura deve retornar 401/403.
  - POST valido deve processar normalmente.

3. Enum de status de lead
- Arquivo: apps/api/src/routes/leads.routes.ts
- Mudanca exata:
  - Validar com enum oficial Prisma (`LeadStatus`).
  - Opcional: mapear legacy values para enum atual.
- Validacao:
  - PATCH com status valido do enum retorna 200.
  - PATCH com invalido retorna 400 consistente.

4. conversationId no webhook
- Arquivo: apps/api/src/webhooks/waha.webhook.ts
- Mudanca exata:
  - Garantir `conversation` criada/recuperada antes de criar mensagens.
  - Usar id da conversa efetivamente persistida.
- Validacao:
  - Novo contato cria conversa + mensagens INBOUND/OUTBOUND sem erro.

5. Baseline de migrations
- Arquivo: packages/db/prisma/migrations/*
- Mudanca exata:
  - Criar baseline migration do estado atual e registrar historico no banco.
- Validacao:
  - `prisma migrate status` deve indicar up-to-date.
  - `prisma migrate deploy` deve executar sem P3005.

## SCORE DE QUALIDADE

- Seguranca: 4.8/10
- Estabilidade: 6.2/10
- Performance: 6.8/10
- Cobertura de erros: 5.9/10
- Qualidade de codigo: 5.7/10

Score geral estimado: 5.9/10

## Correcoes aplicadas imediatamente nesta auditoria

1. Validacao obrigatoria de env no startup
- Arquivo: apps/api/src/config/env.ts
- Integracao: apps/api/src/server.ts

2. Helmet habilitado para headers de seguranca
- Arquivo: apps/api/src/server.ts

3. Rate limit global (100 req/min por IP)
- Arquivo: apps/api/src/server.ts

4. Dependencia de seguranca instalada
- Arquivo: apps/api/package.json
- Pacote: helmet
