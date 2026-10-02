#!/bin/sh
set -eu
psql --username postgres --dbname topout --set ON_ERROR_STOP=1 <<'SQL'
\set app_password `cat /run/secrets/app_password`
\set migration_password `cat /run/secrets/migration_password`
CREATE ROLE topout_migrator LOGIN PASSWORD :'migration_password';
CREATE ROLE topout_app LOGIN PASSWORD :'app_password';
REVOKE ALL ON DATABASE topout FROM PUBLIC;
GRANT CONNECT, CREATE ON DATABASE topout TO topout_migrator;
GRANT CONNECT ON DATABASE topout TO topout_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO topout_migrator;
GRANT USAGE ON SCHEMA public TO topout_app;
ALTER DEFAULT PRIVILEGES FOR ROLE topout_migrator IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO topout_app;
ALTER DEFAULT PRIVILEGES FOR ROLE topout_migrator IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO topout_app;
SQL
