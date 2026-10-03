# Topout

Track gym workouts and climbing in a shared Android, iOS, and web app.

## Requirements

- Node.js 24
- .NET SDK 10 (see `global.json`)
- Docker with Linux containers
- EF Core CLI 10: `dotnet tool install --global dotnet-ef --version "10.*"`

## Run locally

From the repository root:

```powershell
npm ci
npm run db:up
npm run db:migrate
```

Start the API and frontend in separate terminals:

```powershell
npm run api:dev
```

```powershell
npm run dev
```

Open http://localhost:8081. The API runs on http://127.0.0.1:5080.
Local database credentials and a development-only JWT key are included; no manual secret
setup is needed. Never use these defaults in production.

## Project layout

- `apps/app`: Expo frontend
- `packages/shared`: API client, types, and runtime validation
- `server/src`: ASP.NET Core API, application, domain, and infrastructure layers
- `server/tests`: backend tests
- `e2e`: Playwright browser tests

## Checks

```powershell
npm run typecheck
npm test
npm run build
dotnet test server/Topout.sln -m:1
```

See [frontend development](docs/frontend.md) for mobile setup and browser tests, and
[backend development](docs/backend.md) for database configuration and migrations.
