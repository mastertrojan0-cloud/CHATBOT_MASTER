# 🔌 Integração com Backend

## Como Conectar o Dashboard com Seu Backend

### 1. Configurar Variáveis de Ambiente

Crie `.env.local` na raiz do dashboard:

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 2. Usar o API Client

O dashboard já possui um client Axios pronto:

```typescript
import { apiClient } from '@/config/api';

// Exemplo: buscar métricas
const metrics = await apiClient.getDashboardMetrics();

// Exemplo: atualizar lead
await apiClient.updateLead('lead-id', {
  status: 'qualified',
  score: 95,
});
```

### 3. Adicionar Endpoints Necessários

Configure estes endpoints no seu backend:

#### Métricas
```
GET /api/metrics
Response: {
  leadsToday: 5,
  leadsThisMonth: 47,
  messagesThisMonth: 203,
  contactsToday: 3,
  conversionRate: 0.15,
  avgResponseTime: 300,
  recentLeads: []
}

GET /api/metrics/leads-by-day?days=30
Response: [
  { date: "2024-01-01", leads: 3 },
  { date: "2024-01-02", leads: 5 },
  ...
]

GET /api/metrics/top-interests
Response: [
  { name: "Plano A", count: 15, percentage: 32 },
  { name: "Plano B", count: 12, percentage: 26 },
  ...
]
```

#### Leads
```
GET /api/leads?page=1&limit=10&search=&status=&...
Response: {
  data: [
    {
      id: "lead-1",
      name: "João Silva",
      phone: "11987654321",
      email: "joao@example.com",
      status: "interested",
      score: 85,
      interests: ["Produto A"],
      createdAt: "2024-01-01T10:00:00Z",
      updatedAt: "2024-01-02T14:30:00Z",
      lastInteractionAt: "2024-01-02T14:30:00Z",
      messages: 3
    }
  ],
  pagination: {
    page: 1,
    limit: 10,
    total: 47,
    pages: 5
  }
}

PUT /api/leads/:id
Body: { status: "qualified", score: 95 }

DELETE /api/leads/:id

GET /api/leads/export/csv
Response: Arquivo CSV
```

#### WhatsApp WAHA
```
GET /api/waha/status
Response: {
  state: "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "SCAN_QR_CODE",
  qr?: "data:image/png;base64,...",
  message?: "Descrição do estado"
}

GET /api/waha/qr
Response: { qr: "data:image/png;base64,..." }

POST /api/waha/connect
Response: { success: true }
```

#### Tenant
```
GET /api/tenant
Response: {
  id: "tenant-1",
  name: "João Silva",
  businessName: "Minha Empresa",
  plan: "pro",
  usage: {
    leadsPerMonth: 47,
    leadsPerMonthLimit: 100,
    messagesPerMonth: 203
  },
  waConnected: true,
  waStatus: "connected"
}

PUT /api/tenant/settings
Body: {
  businessName: "...",
  industry: "...",
  phone: "...",
  email: "...",
  website: "..."
}

PUT /api/tenant/notifications
Body: {
  waNotifications: true,
  emailNotifications: true,
  newLeadAlert: true,
  messageAlert: true
}
```

#### Google Sheets
```
POST /api/integrations/google-sheets
Body: {
  spreadsheetId: "abc123...",
  sheetName: "Leads"
}

GET /api/integrations/google-sheets
Response: {
  connected: true,
  spreadsheetId: "abc123...",
  sheetName: "Leads"
}

POST /api/integrations/google-sheets/oauth
Response: { oauthUrl: "https://accounts.google.com/..." }
```

#### Auth
```
POST /api/auth/logout
```

### 4. Exemplo: Implementar Métricas

Em seu backend (Node/Express):

```typescript
app.get('/api/metrics', async (req, res) => {
  const tenantId = req.user.tenantId;

  const leadsToday = await Lead.countDocuments({
    tenantId,
    createdAt: {
      $gte: new Date(new Date().setHours(0, 0, 0, 0))
    }
  });

  const leadsThisMonth = await Lead.countDocuments({
    tenantId,
    createdAt: {
      $gte: new Date(new Date().setDate(1))
    }
  });

  const messagesThisMonth = await Message.countDocuments({
    tenantId,
    createdAt: {
      $gte: new Date(new Date().setDate(1))
    }
  });

  const qualified = await Lead.countDocuments({
    tenantId,
    status: 'qualified'
  });

  const conversionRate = leadsThisMonth > 0 
    ? (qualified / leadsThisMonth) 
    : 0;

  const recentLeads = await Lead.find({ tenantId })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  res.json({
    leadsToday,
    leadsThisMonth,
    messagesThisMonth,
    contactsToday: leadsToday,
    conversionRate,
    avgResponseTime: 300, // Calcular conforme sua lógica
    recentLeads
  });
});
```

### 5. Exemplo: Implementar Leads

Em seu backend:

```typescript
app.get('/api/leads', async (req, res) => {
  const { page = 1, limit = 10, search, status } = req.query;
  const tenantId = req.user.tenantId;

  const filter: any = { tenantId };
  
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  if (status) {
    filter.status = status;
  }

  const total = await Lead.countDocuments(filter);
  const data = await Lead.find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit))
    .lean();

  res.json({
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / limit)
    }
  });
});
```

### 6. Autenticação

O dashboard espera um token JWT no localStorage. Implemente:

```typescript
// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  // Validar credenciais
  const user = await User.findOne({ email: req.body.email });
  
  const token = jwt.sign(
    { id: user.id, tenantId: user.tenantId },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({ token, user });
});

// Middleware para verificar token
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Aplicar middleware
app.use('/api/', authMiddleware);
```

### 7. CORS

Configure CORS no seu backend:

```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 8. Testes

Teste os endpoints usando:

```bash
# Verificar API
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/metrics

# Com arquivo .env
cat .env | grep VITE_API_URL
```

### 9. Erros Comuns

**CORS Error**: Configure CORS no backend
```typescript
app.use(cors({ origin: 'http://localhost:5173' }));
```

**401 Unauthorized**: Token ausente ou inválido
```typescript
// Verificar token no localStorage
console.log(localStorage.getItem('authToken'));
```

**500 Error**: Verificar logs do backend
```bash
tail -f logs/app.log
```

### 10. Deploy

Para produção:

```env
VITE_API_URL=https://api.seu-dominio.com/api
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_publica
```

---

## Checklist de Integração

- [ ] Criar arquivo `.env.local`
- [ ] Implementar endpoints `/api/metrics`
- [ ] Implementar endpoints `/api/leads`
- [ ] Implementar endpoints `/api/tenant`
- [ ] Implementar endpoint `/api/auth/logout`
- [ ] Implementar `/api/waha/status`
- [ ] Configurar CORS
- [ ] Testar autenticação
- [ ] Testar busca de leads
- [ ] Testar atualização de status
- [ ] Verificar tratamento de erros
- [ ] Deploy em staging
- [ ] Teste com dados reais
- [ ] Deploy em produção

---

## Suporte

Para dúvidas sobre a integração:
1. Verificar `EXAMPLES.md` para exemplos de código
2. Verificar `ARCHITECTURE.md` para entender a estrutura
3. Consultar tipagem em `src/types/index.ts`
