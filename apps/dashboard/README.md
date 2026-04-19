# FlowDesk Dashboard

Dashboard React completo para gerenciamento de leads com integração WhatsApp.

## Recursos

- 📊 Dashboard com métricas em tempo real
- 📋 Tabela completa de leads com filtros e busca
- 📱 QR code ao vivo para conexão WhatsApp
- ⚙️ Configurações avançadas e integrações
- 🎨 Design system completo com Tailwind CSS
- 🔄 React Query para gerenciamento de dados
- 🧭 Router TanStack para navegação
- 🛢️ Zustand para state management

## Estrutura

```
src/
├── components/        # Componentes reutilizáveis
├── pages/             # Páginas da aplicação
├── layout/            # Layout principal
├── hooks/             # Hooks customizados
├── stores/            # Zustand stores
├── config/            # Configurações (API, Router, QueryClient)
├── design/            # Design tokens
├── types/             # Tipos TypeScript
├── utils/             # Funções utilitárias
├── App.tsx            # App wrapper com router
├── main.tsx           # Entry point
└── index.css          # Tailwind CSS
```

## Dependências principais

- `react` & `react-dom` - Biblioteca UI
- `@tanstack/react-router` - Roteamento
- `@tanstack/react-query` - Data fetching & caching
- `zustand` - State management
- `tailwindcss` - Utilitários CSS
- `recharts` - Gráficos
- `sonner` - Notificações
- `lucide-react` - Ícones
- `axios` - HTTP client
- `@supabase/supabase-js` - Supabase client

## Desenvolvimento

```bash
yarn dev          # Inicia servidor de desenvolvimento
yarn build        # Build para produção
yarn preview      # Preview da build
yarn lint         # Verifica tipos TypeScript
yarn typecheck    # Type checking
```

## Variáveis de Ambiente

Crie um arquivo `.env.local`:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_supabase
```
