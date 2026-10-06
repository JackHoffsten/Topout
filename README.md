<p align="center">
  <img src="apps/app/assets/topout-icon.png" alt="Topout logo" width="96" height="96" />
</p>

# Topout

Track gym workouts and climbing in one app for Android, iOS, and web.

[Web app](https://topout.jackhoffsten.se) · [Getting started](#run-locally) · [Architecture](#architecture) · [Tests](#checks)

## About

Topout brings workout planning, set-by-set logging, and climbing history together.
It is a full-stack monorepo with a shared Expo frontend and an ASP.NET Core API,
with a mobile-first interface and light and dark themes.

### Features

- Plan workouts and rest days in a calendar using reusable workout templates.
- Create exercises with multiple muscle groups, arrange template exercises, and
  optionally specify sets, rep ranges, and target weights.
- Log individual sets, including separate left/right results, edit completed
  workouts, and update template targets from saved results.
- Record climbs with grades, climbing type, environment, attempts, ascent style,
  wall angle, hold styles, location, and an optional photo.
- Search, filter, and sort exercise, template, and climbing history.
- View training and climbing progress through overview and exercise-specific charts.

### Built with

- **Frontend:** TypeScript, React Native, Expo Router, and React Native Web.
- **State and validation:** TanStack Query, React Hook Form, and Zod.
- **Backend:** C#, ASP.NET Core, Identity, and Entity Framework Core.
- **Database:** PostgreSQL.
- **Delivery:** Docker, Caddy, Jenkins, and Expo Application Services for native builds.

## Architecture

The frontend shares screens and application logic across native and web, with
platform-specific implementations where keyboard handling, storage, or browser
behavior differs. `packages/shared` contains the API client and Zod-validated
request and response contracts.

The backend separates domain rules, application use cases, infrastructure, and HTTP
endpoints. Authenticated resources are scoped to the current account. Native sessions
use SecureStore for refresh tokens; browser sessions use HttpOnly cookies with CSRF
protection. Access tokens stay in memory.

The Jenkins pipeline runs backend tests, frontend tests, type checks, and a web build
before building and deploying the production containers.

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

The test suite includes domain and application tests, PostgreSQL-backed API integration
tests, shared-client tests, and React Native component tests. Playwright covers browser
flows at phone and desktop sizes.

```powershell
npm run typecheck
npm test
npm run build
dotnet test server/Topout.sln -m:1
```

See [frontend development](docs/frontend.md) for mobile setup and browser tests, and
[backend development](docs/backend.md) for database configuration and migrations.

## Feedback

Found a bug or have a suggestion? [Open an issue](https://github.com/JackHoffsten/Topout/issues)
with the steps to reproduce it and the platform you are using.

## License

Licensed under the [MIT License](LICENSE). Third-party dependencies and bundled fonts
retain their own licenses; see the [Cascadia Mono license](apps/app/assets/fonts/LICENSE.txt).
