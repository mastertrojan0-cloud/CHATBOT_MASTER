# ⚡ Quick Start - Dashboard FlowDesk

## 🚀 Começar em 5 Minutos

### 1️⃣ Instalar dependências
```bash
cd apps/dashboard
yarn install
```

### 2️⃣ Criar arquivo .env
```bash
cp .env.example .env.local
```

### 3️⃣ Iniciar servidor
```bash
yarn dev
```

### 4️⃣ Acessar
```
http://localhost:5173
```

## 📁 Estrutura Principal

```
src/
├── pages/      ← 4 páginas prontas
├── components/ ← 9 componentes reutilizáveis
├── layout/     ← Sidebar + Topbar
├── hooks/      ← Queries e mutations
├── stores/     ← Zustand stores
└── config/     ← Router, API, QueryClient
```

## 🎯 Próximas Etapas

### 1. Conectar Backend
- Implementar endpoints em `INTEGRATION.md`
- Atualizar `src/config/api.ts` se necessário
- Configurar `VITE_API_URL` no `.env.local`

### 2. Customizar
- Cores em `tailwind.config.ts`
- Tipografia em `src/design/tokens.ts`
- Logo na `Layout.tsx`

### 3. Expandir
- Adicionar novas páginas em `src/pages/`
- Adicionar rotas em `src/config/router.tsx`
- Adicionar queries em `src/hooks/queries.ts`

## 📚 Documentação

- **COMPLETION_SUMMARY.md** - O que foi criado
- **ARCHITECTURE.md** - Estrutura detalhada
- **INTEGRATION.md** - Como conectar backend
- **EXAMPLES.md** - Exemplos de código

## 🎨 Personalizações Rápidas

### Mudar cor primária
Em `tailwind.config.ts`, editar cores brand:
```js
brand: {
  600: '#YourColor',
  700: '#YourColorDarker',
}
```

### Mudar font
Em `index.html`, trocar Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=YourFont:wght@400;700&display=swap" />
```

### Mudar logo
Em `src/layout/Layout.tsx`, trocar a div com background gradient.

## 🔑 Variáveis de Ambiente

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=seu-supabase
VITE_SUPABASE_ANON_KEY=sua-chave
```

## 🧪 Scripts Disponíveis

```bash
yarn dev         # Desenvolvimento
yarn build       # Build produção
yarn preview     # Ver build
yarn lint        # Type checking
yarn typecheck   # Verificar tipos
```

## ✅ Checklist Inicial

- [ ] Dependências instaladas
- [ ] `.env.local` criado
- [ ] `yarn dev` rodando
- [ ] Dashboard acessível em localhost:5173
- [ ] Backend endpoints implementados
- [ ] `.env.local` configurado com API_URL
- [ ] Autenticação funcionando
- [ ] Leads carregando
- [ ] Customizações aplicadas
- [ ] Deploy planejado

## 🆘 Troubleshooting

**Erro: Cannot find module '@tanstack/react-router'**
```bash
yarn install
```

**Erro: VITE_API_URL não definido**
```bash
# Verificar .env.local existe
ls -la .env.local

# Se não existir
cp .env.example .env.local
```

**Erro: Port 5173 already in use**
```bash
# Usar outra porta
yarn dev -- --port 5174
```

**Erro: 404 na API**
- Verificar VITE_API_URL está correto
- Verificar backend está rodando
- Verificar CORS configurado

## 📞 Support

Para dúvidas:
1. Ler `ARCHITECTURE.md` - estrutura completa
2. Ver `INTEGRATION.md` - como integrar backend
3. Checar `EXAMPLES.md` - exemplos de código
4. Verificar `src/types/index.ts` - tipos disponíveis

---

**Status: ✅ Pronto para usar!**

O dashboard está completo, tipado, e pronto para integração com seu backend.
