# 📊 FlowDesk Dashboard - Estrutura Completa

## 🏗️ Estrutura de Arquivos

```
apps/dashboard/
├── src/
│   ├── components/              # Componentes reutilizáveis
│   │   ├── Button.tsx           # Botão com variantes (primary, secondary, outline, ghost)
│   │   ├── Card.tsx             # Card com suporte a header, body, footer
│   │   ├── Badge.tsx            # Badge com variantes de cor
│   │   ├── Input.tsx            # Input com label, error e helper text
│   │   ├── Select.tsx           # Select com opções customizáveis
│   │   ├── MetricCard.tsx       # Card de métrica com delta e ícone
│   │   ├── Alert.tsx            # Alert com tipos (info, success, warning, error)
│   │   ├── Table.tsx            # Componentes de tabela (Table, Header, Body, Row, Cell)
│   │   ├── ConfirmDialog.tsx    # Dialog de confirmação
│   │   └── index.ts             # Exports centralizados
│   │
│   ├── pages/                   # Páginas da aplicação
│   │   ├── DashboardPage.tsx    # Dashboard com métricas, gráfico e leads recentes
│   │   ├── LeadsPage.tsx        # Tabela de leads com filtros e paginação
│   │   ├── ConnectPage.tsx      # QR code do WhatsApp com instruções
│   │   └── SettingsPage.tsx     # Configurações, notificações e integrações
│   │
│   ├── layout/                  # Layout da aplicação
│   │   ├── Layout.tsx           # Layout principal com Sidebar e conteúdo
│   │   └── Topbar.tsx           # Barra superior com nome do negócio e status
│   │
│   ├── hooks/                   # Hooks customizados
│   │   ├── queries.ts           # React Query hooks (getDashboardMetrics, getLeads, etc)
│   │   ├── mutations.ts         # React Query mutations (updateLead, exportCSV, etc)
│   │   └── index.ts             # Hooks utilitários (useLocalStorage, useDebounce, etc)
│   │
│   ├── stores/                  # Zustand stores
│   │   ├── authStore.ts         # Store de autenticação e tenant
│   │   └── leadsStore.ts        # Store de leads com filtros e paginação
│   │
│   ├── config/                  # Configurações
│   │   ├── api.ts               # Client Axios com interceptadores
│   │   ├── queryClient.ts       # Configuração do React Query
│   │   └── router.tsx           # TanStack Router com todas as rotas
│   │
│   ├── design/                  # Design system
│   │   └── tokens.ts            # Tokens de cores, espaçamento, tipografia
│   │
│   ├── types/                   # Tipos TypeScript
│   │   └── index.ts             # Interfaces (Tenant, Lead, User, etc)
│   │
│   ├── utils/                   # Funções utilitárias
│   │   ├── format.ts            # Formatadores (phone, date, currency, etc)
│   │   ├── helpers.ts           # Helpers (delay, retry, debounce, throttle)
│   │   └── index.ts             # Exports
│   │
│   ├── App.tsx                  # Root component com providers
│   ├── AppLayout.tsx            # Layout wrapper
│   ├── main.tsx                 # Entry point
│   ├── index.css                # Tailwind CSS com custom classes
│   └── vite-env.d.ts            # Tipos do Vite
│
├── public/                      # Arquivos estáticos
├── index.html                   # HTML principal
├── vite.config.ts               # Configuração Vite
├── tailwind.config.ts           # Configuração Tailwind
├── postcss.config.js            # Configuração PostCSS
├── tsconfig.json                # TypeScript config local
├── package.json                 # Dependências e scripts
├── .env.example                 # Exemplo de variáveis de ambiente
├── .gitignore                   # Arquivos a ignorar
├── setup.sh                     # Script setup para Unix/Linux/Mac
├── setup.bat                    # Script setup para Windows
└── README.md                    # Documentação
```

## 🎨 Design System

### Paleta de Cores
- **Brand**: Verde escuro (#15803d a #f0fdf4)
- **Dark**: Cinzento escuro (#030712 a #f9fafb)
- **Semanais**: Green, Yellow, Red para status

### Tipografia
- **Display**: Syne (h1, h2, h3 - titulos grandes)
- **Body**: DM Sans (texto, labels, etc)

### Componentes Principais
- **Button**: Primário, Secundário, Outline, Ghost (sm, md, lg)
- **Card**: Elevado ou padrão com header/body/footer
- **Badge**: Brand, Success, Warning, Error, Neutral
- **Input**: Com label, erro e helper text
- **MetricCard**: Com valor, label, delta e ícone
- **Alert**: Info, Success, Warning, Error

## 📄 Páginas

### Dashboard
- Métricas em tempo real (leads hoje/mês, mensagens, contatos)
- Gráfico de área Recharts com leads por dia
- Principais interesses com barras de progresso
- Tabela de leads recentes
- Alerta visual quando Free atinge 80% do limite

### Leads
- Tabela completa com busca
- Filtros por status
- Paginação
- Select de status inline
- Score visual com barra
- Link "Chamar no WA"
- Exportar CSV (apenas Pro)

### Conectar
- QR code ao vivo com polling 3s
- Estados visuais para cada status WAHA
- Instruções passo a passo

### Configurações
- Dados do negócio
- Notificações Pro (WA + email)
- Integração Google Sheets OAuth
- Card upgrade Pro em dark com checklist

## 🛠️ Stack Técnico

### Frontend
- **React 18** - Biblioteca UI
- **Vite** - Build tool
- **TypeScript** - Type safety
- **Tailwind CSS** - Utilitários CSS
- **TanStack Router** - Roteamento
- **TanStack React Query** - Data fetching & cache
- **Zustand** - State management
- **Recharts** - Gráficos
- **Sonner** - Notificações toast
- **Lucide React** - Ícones

### Dados & API
- **Axios** - HTTP client
- **@supabase/supabase-js** - Backend as a service

## 🚀 Como Iniciar

### Instalação
```bash
# Na raiz do projeto
yarn install

# Ou apenas no dashboard
cd apps/dashboard
yarn install
```

### Desenvolvimento
```bash
# Na raiz (executa todos os apps)
yarn dev

# Ou apenas no dashboard
cd apps/dashboard
yarn dev
```

### Build
```bash
# Na raiz
yarn build

# Ou apenas no dashboard
cd apps/dashboard
yarn build
```

### Variáveis de Ambiente
Crie `.env.local`:
```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```

## 📦 Dependências Principais

```json
{
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "@tanstack/react-router": "^1.26.0",
  "@tanstack/react-query": "^5.28.0",
  "zustand": "^4.4.0",
  "tailwindcss": "^3.3.5",
  "recharts": "^2.10.3",
  "sonner": "^1.3.0",
  "lucide-react": "^0.294.0",
  "axios": "^1.6.0",
  "@supabase/supabase-js": "^2.38.0",
  "qrcode.react": "^1.0.1"
}
```

## 🔑 Funcionalidades Principais

✅ Dashboard com métricas em tempo real
✅ Gerenciamento de leads com tabela completa
✅ Integração WhatsApp com QR code
✅ Filtros e busca avançada
✅ Paginação
✅ Exportação CSV (Pro)
✅ Configurações do negócio
✅ Integração Google Sheets (Pro)
✅ Notificações (Pro)
✅ Design system completo
✅ Dark mode por padrão
✅ Responsive design
✅ TypeScript full
✅ Error handling
✅ Loading states

## 📱 Responsive

- Mobile: Sidebar colapsável, layout em coluna única
- Tablet: Grid 2 colunas
- Desktop: Grid adaptável até 4 colunas

## 🔐 Autenticação

O dashboard espera um token Bearer no header de todas as requisições:
```
Authorization: Bearer <token>
```

Armazenado em `localStorage` sob a chave `authToken`.
