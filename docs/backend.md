# Backend development

The backend uses ASP.NET Core, Identity, EF Core, and PostgreSQL on .NET 10.
Follow the [local setup](../README.md#run-locally) first.

## Code layout

- `Topout.Domain`: entities and business rules
- `Topout.Application`: use cases and interfaces
- `Topout.Infrastructure`: persistence and authentication services
- `Topout.Api`: HTTP endpoints, validation, and configuration

API routes cover authentication, exercises, workout templates, calendar plans, workout
logs, climbing logs, and progress. Feature endpoints require authentication and scope
records to the signed-in account. Shared request/response contracts live in
`packages/shared`; HTTP controllers live in `server/src/Topout.Api`.

Errors use Problem Details: 400 for invalid input, 401 for missing/invalid authentication,
404 for missing or other-account resources, 409 for conflicts, and 429 for rate limits.

## Database

`compose.yaml` runs PostgreSQL on localhost port 5432. Development defaults are database
`topout`, username `postgres`, and password `postgres`.

```powershell
npm run db:up
npm run db:migrate
npm run db:logs
npm run db:down
```

Stopping preserves data in the `topout-postgres-data` Docker volume.
Removing that volume permanently deletes the local database.

To customize Docker settings, copy `.env.example` to `.env` before the first start.
Match those settings in the API connection string:

```powershell
dotnet user-secrets set "ConnectionStrings:Default" "Host=127.0.0.1;Port=5432;Database=topout;Username=postgres;Password=YOUR_PASSWORD" --project server/src/Topout.Api
```

Changing Docker's initialization credentials does not change an existing database volume.
The migration context reads development user secrets and environment variables.
The API does not apply migrations automatically during normal startup.

## Configuration and authentication

Development configuration includes a public, development-only JWT key. Production requires
a private signing key of at least 32 UTF-8 bytes and a database connection string.
Supply `Jwt__SigningKey` and `ConnectionStrings__Default` through secret-managed
configuration; never commit production credentials.

Native authentication returns access and rotating refresh tokens. Browser authentication
uses `/api/auth/web`, HttpOnly refresh cookies, and CSRF protection; refresh tokens
are not returned to browser JavaScript. Use the shared session client rather than
implementing token renewal in individual screens.

Production browser sessions require HTTPS. Credentialed CORS accepts only configured
`Web:AllowedOrigins` (environment variables such as `Web__AllowedOrigins__0`).
Persist Data Protection keys and trust forwarded headers only from known proxies.
Never log passwords, tokens, or authorization headers.

## Migrations and tests

Create a migration after changing the persistence model:

```powershell
dotnet ef migrations add MigrationName --project server/src/Topout.Infrastructure --startup-project server/src/Topout.Api
npm run db:migrate
```

Build before checking that the model matches its migrations:

```powershell
dotnet build server/Topout.sln
dotnet ef migrations has-pending-model-changes --project server/src/Topout.Infrastructure --startup-project server/src/Topout.Api --no-build
dotnet test server/Topout.sln -m:1
```

Integration tests need Docker and create disposable PostgreSQL containers, not the local
development database. Review migrations before applying them to an existing database;
back up production data before upgrades.

Check backend formatting with:

```powershell
dotnet tool restore
dotnet tool run csharpier -- check server/src/Topout.Api server/src/Topout.Application server/tests
```
