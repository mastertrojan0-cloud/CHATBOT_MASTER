@echo off
REM FlowDesk API Setup Script for Windows
REM Quick setup para desenvolvimento

echo.
echo 🚀 FlowDesk API - Setup Script
echo ================================
echo.

REM 1. Verificar Node.js
echo 1️⃣  Verificando Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ✗ Node.js não encontrado. Por favor instale Node.js 18+
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo ✓ Node.js %NODE_VERSION% encontrado
echo.

REM 2. Verificar Yarn
echo 2️⃣  Verificando Yarn...
where yarn >nul 2>nul
if %errorlevel% neq 0 (
    echo ⚠ Yarn não encontrado. Usando npm...
    set PACKAGE_MANAGER=npm
) else (
    for /f "tokens=*" %%i in ('yarn -v') do set YARN_VERSION=%%i
    echo ✓ Yarn %YARN_VERSION% encontrado
    set PACKAGE_MANAGER=yarn
)
echo.

REM 3. Instalar dependências
echo 3️⃣  Instalando dependências...
if "%PACKAGE_MANAGER%"=="npm" (
    call npm install
) else (
    call yarn install
)
if %errorlevel% neq 0 (
    echo ✗ Erro ao instalar dependências
    exit /b 1
)
echo ✓ Dependências instaladas
echo.

REM 4. Criar .env.local
echo 4️⃣  Verificando .env...
if not exist ".env.local" (
    if exist ".env.example" (
        copy .env.example .env.local
        echo ✓ Arquivo .env.local criado a partir de .env.example
        echo ⚠ IMPORTANTE: Edite .env.local com suas credenciais do Supabase
    ) else (
        echo ✗ .env.example não encontrado
        exit /b 1
    )
) else (
    echo ✓ .env.local já existe
)
echo.

REM 5. Build TypeScript
echo 5️⃣  Compilando TypeScript...
if "%PACKAGE_MANAGER%"=="npm" (
    call npm run build
) else (
    call yarn build
)
if %errorlevel% neq 0 (
    echo ✗ Erro ao compilar TypeScript
    exit /b 1
)
echo ✓ TypeScript compilado
echo.

REM 6. Resumo
echo ================================
echo ✓ Setup Completo!
echo ================================
echo.
echo Próximos passos:
echo.
echo 1. Edite .env.local com suas credenciais:
echo    - SUPABASE_URL
echo    - SUPABASE_SERVICE_KEY
echo    - STRIPE_SECRET_KEY (opcional)
echo.
echo 2. Inicie o servidor em modo desenvolvimento:
if "%PACKAGE_MANAGER%"=="npm" (
    echo    npm run dev
) else (
    echo    yarn dev
)
echo.
echo 3. Teste a API:
echo    curl http://localhost:3000/health
echo.
echo 4. Para documentação completa:
echo    - QUICKSTART.md - Setup rápido
echo    - INTEGRATION.md - Exemplos de endpoints
echo    - ARCHITECTURE.md - Visão geral
echo.
