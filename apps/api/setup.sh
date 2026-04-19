#!/bin/bash

# FlowDesk API Setup Script
# Rápido setup para desenvolvimento

set -e

echo "🚀 FlowDesk API - Setup Script"
echo "================================"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função de log
log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Verificar Node.js
echo ""
echo "1️⃣ Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    log_success "Node.js $NODE_VERSION encontrado"
else
    log_error "Node.js não encontrado. Por favor instale Node.js 18+"
    exit 1
fi

# 2. Verificar Yarn
echo ""
echo "2️⃣ Verificando Yarn..."
if command -v yarn &> /dev/null; then
    YARN_VERSION=$(yarn -v)
    log_success "Yarn $YARN_VERSION encontrado"
else
    log_warning "Yarn não encontrado. Usando npm..."
    PACKAGE_MANAGER="npm"
fi

# 3. Instalar dependências
echo ""
echo "3️⃣ Instalando dependências..."
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm install
else
    yarn install
fi
log_success "Dependências instaladas"

# 4. Criar .env.local
echo ""
echo "4️⃣ Verificando .env..."
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        log_success "Arquivo .env.local criado a partir de .env.example"
        log_warning "⚠️  IMPORTANTE: Edite .env.local com suas credenciais do Supabase"
    else
        log_error ".env.example não encontrado"
        exit 1
    fi
else
    log_success ".env.local já existe"
fi

# 5. Build TypeScript
echo ""
echo "5️⃣ Compilando TypeScript..."
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    npm run build
else
    yarn build
fi
log_success "TypeScript compilado"

# 6. Resumo
echo ""
echo "================================"
echo "✅ Setup Completo!"
echo "================================"
echo ""
echo "Próximos passos:"
echo ""
echo "1. Edite .env.local com suas credenciais:"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_SERVICE_KEY"
echo "   - STRIPE_SECRET_KEY (opcional)"
echo ""
echo "2. Inicie o servidor em modo desenvolvimento:"
if [ "$PACKAGE_MANAGER" = "npm" ]; then
    echo "   npm run dev"
else
    echo "   yarn dev"
fi
echo ""
echo "3. Teste a API:"
echo "   curl http://localhost:3000/health"
echo ""
echo "4. Para documentação completa:"
echo "   - QUICKSTART.md - Setup rápido"
echo "   - INTEGRATION.md - Exemplos de endpoints"
echo "   - ARCHITECTURE.md - Visão geral"
echo ""
