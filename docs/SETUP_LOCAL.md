# Configuração Local - GESTOR CFTV

## PostgreSQL Nativo

### Pré-requisitos
- PostgreSQL 14+ instalado no Windows
- Porta: 5432

### Instalação
Consulte [INSTALL_POSTGRES_WINDOWS.md](INSTALL_POSTGRES_WINDOWS.md)

### Comandos de Validação

```powershell
pg_isready -h localhost -p 5432
```

Resultado esperado: `localhost:5432 - accepting connections`

### Configuração do Banco

```powershell
# Executar scripts/setup_db.sql
psql -h localhost -p 5432 -U postgres -f scripts/setup_db.sql
```

### Cridenciais Padrão
- Usuário: `gestor`
- Senha: `changeme`
- Banco: `gestor_cftv`

### Teste de Conexão

```powershell
psql -h localhost -p 5432 -d gestor_cftv -U gestor -c "SELECT 1;"
```