# Instalação do PostgreSQL no Windows

## Link Oficial

https://www.postgresql.org/download/windows/

## Passos Guiados de Instalação

### 1. Download
Acesse https://www.postgresql.org/download/windows/ e baixe o instalador mais recente (versão x.x.x).

### 2. Executar o Instalador
Run o arquivo `.exe` baixado e siga os passos:

### 3. Escolha do Diretório de Instalação
- Mantenha o diretório padrão: `C:\Program Files\PostgreSQL\<versao>`

### 4. Seleção de Componentes
Marque os seguintes componentes:
- [x] PostgreSQL Server
- [x] pgAdmin 4
- [x] Command Line Tools  <--

### 5. Configuração de Dados
- Diretório de dados: `C:\Program Files\PostgreSQL\<versao>\data`

### 6. Configuração de Superusuário
- Username: `postgres`
- Senha: **Digite uma senha segura e anote abaixo**


### 7. Porta
- Porta padrão: `5432` (manter padrão)

### 8. Configurações Avançadas
- Mantenha as opções padrão

### 9. Conclusão
Aguarde a instalação completar.

## Configuração

### Variáveis de Ambiente
Adicione ao PATH:
```
C:\Program Files\PostgreSQL\<versao>\bin
```

## Validação

```powershell
pg_isready -h localhost -p 5432
```

Resultado esperado: `localhost:5432 - accepting connections`

## Notas

- Anote a senha do superuser `postgres` em local seguro
- O serviço PostgreSQL inicia automaticamente com o Windows
- Use o pgAdmin para gerenciamento visual (opcional)