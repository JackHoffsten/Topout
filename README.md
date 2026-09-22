# Topout

Topout is a training application for managing exercises and tracking gym and climbing
progress. It uses a universal Expo application for Android, iOS, and web, with an ASP.NET
Core API and PostgreSQL database.

## Repository structure

- `apps/app` — Expo Router application for Android, iOS, and responsive web
- `packages/shared` — validated API contracts and platform-independent client code
- `server/src/Topout.Domain` — domain entities and business rules
- `server/src/Topout.Application` — application use cases and abstractions
- `server/src/Topout.Infrastructure` — PostgreSQL persistence and authentication services
- `server/src/Topout.Api` — ASP.NET Core API
- `server/tests` — backend unit and integration tests
- `e2e` — Playwright browser tests

## Prerequisites

- Node.js 24
- .NET SDK 10
- Docker with Linux containers

## Local development

Install dependencies and initialize the database:

```powershell
npm ci
npm run db:up
npm run db:migrate
```

Run the API and frontend in separate terminals:

```powershell
npm run api:dev
```

```powershell
npm run dev
```

Open `http://localhost:8081`. The development configuration includes local database
credentials and a development-only JWT signing key.

See [frontend setup](docs/frontend.md) and [backend setup](docs/backend.md) for platform,
configuration, security, and testing details.

## Verification

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
dotnet test server/Topout.sln -m:1
```

Run Expo diagnostics from the application directory:

```powershell
cd apps/app
npx expo-doctor
```
