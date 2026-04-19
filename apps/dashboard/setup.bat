@echo off
REM Install dependencies
echo 📦 Instalando dependências...
call yarn install

REM Setup environment file
if not exist .env.local (
  echo 📝 Criando arquivo .env.local...
  copy .env.example .env.local
  echo ⚠️  Atualize o arquivo .env.local com suas variáveis de ambiente
)

REM Start development server
echo 🚀 Iniciando servidor de desenvolvimento...
call yarn dev
