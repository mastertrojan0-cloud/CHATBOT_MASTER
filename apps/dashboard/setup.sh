#!/bin/bash

# Install dependencies
echo "📦 Instalando dependências..."
yarn install

# Setup environment file
if [ ! -f .env.local ]; then
  echo "📝 Criando arquivo .env.local..."
  cp .env.example .env.local
  echo "⚠️  Atualize o arquivo .env.local com suas variáveis de ambiente"
fi

# Start development server
echo "🚀 Iniciando servidor de desenvolvimento..."
yarn dev
