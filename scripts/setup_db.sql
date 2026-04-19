CREATE USER gestor WITH PASSWORD 'changeme';
CREATE DATABASE gestor_cftv OWNER gestor;
GRANT ALL PRIVILEGES ON DATABASE gestor_cftv TO gestor;