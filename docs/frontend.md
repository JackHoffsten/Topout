# Frontend development

The frontend is a universal Expo Router application in `apps/app`. One codebase targets
Android, iOS, and responsive web. Shared request and response schemas live in
`packages/shared`.

## Prerequisites

- Node.js 24
- npm
- The backend prerequisites described in [backend setup](backend.md)
- Android Studio and an Android SDK for local Android builds
- Xcode on macOS for local iOS builds, or EAS for remote iOS builds

Install workspace dependencies from the repository root:

```powershell
npm ci
```

Expo-managed packages should be installed from `apps/app` with `npx expo install`. Run
`npx expo install --fix` and `npx expo-doctor` after dependency upgrades.

## Web development

Start PostgreSQL and apply migrations once:

```powershell
npm run db:up
npm run db:migrate
```

Run the API and Expo in separate terminals:

```powershell
npm run api:dev
```

```powershell
npm run dev
```

Open `http://localhost:8081`. The web development build calls the API at
`http://localhost:5080`. Development uses local HTTP session cookies; secure cookies remain
required in test and production environments.

## Native development

Start the Expo development server:

```powershell
npm run mobile
```

Build and run a local Android development client:

```powershell
npm run android
```

On macOS, build and run the iOS client with:

```powershell
npm run ios
```

Generated `android` and `ios` projects are ignored. Native project configuration belongs in
`apps/app/app.json` and Expo config plugins.

## API URLs

`EXPO_PUBLIC_API_URL` can be set in `apps/app/.env.local` to override the defaults. This is
public build-time configuration and must not contain secrets.

- Web development: `http://localhost:5080`
- iOS simulator: `http://localhost:5080`
- Android emulator: `http://10.0.2.2:5080`
- Physical device: the development computer's LAN address and API port
- Production web: same-origin `/api` by default

For a physical device, bind the API to an appropriate network interface and allow the port
through the local firewall only on a trusted network. Production deployments must use
HTTPS.

## Web session preview

Production browser sessions use secure HttpOnly cookies. To test the production web export
locally through the included HTTPS proxy:

1. Start the API on `http://127.0.0.1:5080`.
2. Leave `EXPO_PUBLIC_API_URL` unset.
3. Run `npm run build`.
4. Run `node scripts/serve-web.mjs`.
5. Open `https://localhost:8443` and accept the temporary local certificate.

The preview server is for local testing only. A production host must serve the exported
`apps/app/dist` files, route application paths to `index.html`, proxy `/api` to ASP.NET Core,
and provide trusted HTTPS.

## Application structure

- `app` — public and protected Expo Router routes
- `src/features` — authentication and exercise features
- `src/lib` — session and query providers
- `src/ui` — design tokens, reusable components, and responsive navigation
- `packages/shared` — runtime-validated DTOs, API client, and session transports

TanStack Query manages server state in memory. Exercise mutations invalidate the exercise
list. Exercise data and pending mutations are not persisted offline.

## Authentication behavior

Access tokens are held in memory on every platform.

Native refresh tokens are stored with Expo SecureStore. Browser refresh tokens remain in
server-managed HttpOnly cookies and are never stored in localStorage, sessionStorage,
IndexedDB, or JavaScript application state.

Session renewal is single-flight within a client. Browser tabs use Web Locks to coordinate
refresh-token rotation and BroadcastChannel to propagate logout. A request is replayed at
most once after successful renewal. Failed renewal clears the local session.

## Verification

Run the standard frontend checks from the repository root:

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Run Expo diagnostics from the application directory:

```powershell
cd apps/app
npx expo-doctor
```

Playwright tests require Chromium, Docker, .NET 10, and the EF Core command-line tool. They
create an isolated PostgreSQL container, apply migrations, start the API and HTTPS preview,
and test desktop and phone layouts. Ports `5080` and `8443` must be available.

Install the Playwright browser when needed:

```powershell
npx playwright install chromium
```
