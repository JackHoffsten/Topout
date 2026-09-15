# Topout

Topout is a clean starter monorepo for building a web and mobile product with a shared TypeScript package and a layered ASP.NET Core API.

## Structure

- `apps/web` — React + Vite web app
- `apps/mobile` — Expo / React Native mobile app
- `packages/shared` — shared TypeScript code
- `server/Topout.Domain` — domain models and rules
- `server/Topout.Application` — use cases and contracts
- `server/Topout.Infrastructure` — persistence and integrations
- `server/Topout.Api` — HTTP API composition root

## Getting started

```powershell
npm install
npm run dev
```

The API can be started with:

```powershell
dotnet run --project server/Topout.Api
```

## Checks and formatting

```powershell
npm run typecheck
npm run format:check
dotnet build server/Topout.Api
dotnet tool restore --tool-manifest .config/dotnet-tools.json
dotnet tool run csharpier -- check server
```
