# setup_db.ps1 - Configura banco de dados GESTOR CFTV

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$sqlFile = Join-Path $scriptDir "setup_db.sql"

Write-Host "=== Configurando banco de dados GESTOR CFTV ===" -ForegroundColor Cyan

if (-not (Test-Path $sqlFile)) {
    Write-Error "Arquivo SQL não encontrado: $sqlFile"
}

Write-Host "`nExecutando setup_db.sql..." -ForegroundColor Yellow
& psql -h localhost -p 5432 -U postgres -f $sqlFile

if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha ao executar setup_db.sql"
}

Write-Host "`nValidando conexão com usuário gestor..." -ForegroundColor Yellow
& psql -h localhost -p 5432 -d gestor_cftv -U gestor -c "SELECT current_user;"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Falha na conexão com usuário gestor"
}

Write-Host "`n=== Configuração concluída com sucesso! ===" -ForegroundColor Green
Write-Host "Banco de dados: gestor_cftv" -ForegroundColor Green
Write-Host "Usuário: gestor" -ForegroundColor Green
Write-Host "Senha: changeme" -ForegroundColor Green