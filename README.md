# Topout

For logging and planning your climbing and workouts

## Structure

- `apps/web` — React + Vite web app
- `apps/mobile` — Expo / React Native mobile app
- `packages/shared` — shared TypeScript code
- `server/src/Topout.Domain` — domain models and rules
- `server/src/Topout.Application` — use cases and contracts
- `server/src/Topout.Infrastructure` — persistence and integrations
- `server/src/Topout.Api` — HTTP API composition root
- `server/tests` — unit tests and PostgreSQL/API integration tests

## Getting started

```powershell
npm install
npm run dev
```

Configure the JWT signing secret and PostgreSQL first; see [backend setup and API contracts](docs/backend.md).
The API can then be started with:

```powershell
dotnet run --project server/src/Topout.Api -- --environment Development --urls https://localhost:7043
```

## Checks and formatting

```powershell
npm run typecheck
npm run format:check
dotnet build server/Topout.sln -m:1
dotnet test server/Topout.sln -m:1
dotnet tool restore --tool-manifest .config/dotnet-tools.json
dotnet tool run csharpier -- check server
```
