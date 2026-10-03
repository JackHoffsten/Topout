# Frontend development

The Expo app in `apps/app` targets web, Android, and iOS. Start with the
[local setup](../README.md#run-locally) in the README.

## Mobile

```powershell
npm run mobile
npm run android
```

Android builds require Android Studio and an Android SDK. On macOS with Xcode, use
`npm run ios`. Remote native builds can use EAS.

Generated `android` and `ios` directories are ignored. Keep native configuration in
`apps/app/app.json` and Expo config plugins.

## API connection

Override the API origin with `EXPO_PUBLIC_API_URL` in `apps/app/.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://localhost:5080
```

Defaults are localhost for web development and iOS simulators, and
`http://10.0.2.2:5080` for Android emulators. For a physical device, use the development
computer's LAN address. Bind the API to that network interface and allow its port on a
trusted network; the default API command listens only on loopback.

Production web uses the same origin by default. The client adds `/api` to the origin,
so do not include it in the environment variable. Public Expo variables are bundled into
the app and must not contain secrets.

## Code layout

- `app`: Expo Router screens and layouts
- `src/features`: feature screens and editors
- `src/lib`: session and query providers
- `src/ui`: shared components, navigation, and theme
- `packages/shared`: Zod contracts and API/session clients

TanStack Query caches server data in memory. Access tokens stay in memory; native refresh
tokens use SecureStore and browser refresh tokens use HttpOnly cookies. Requests can
renew a session and retry once. There is no offline mutation queue.

## Checks and web preview

From the repository root:

```powershell
npm run typecheck
npm test
npm run build
```

The web export is written to `apps/app/dist`. To preview it with local HTTPS, start the
API, leave `EXPO_PUBLIC_API_URL` unset, and run `node scripts/serve-web.mjs`. Open
https://localhost:8443 and accept the local test certificate. This server is not for
production use.

For Playwright, keep Docker running and install Chromium once:

```powershell
npx playwright install chromium
dotnet build server/Topout.sln
npm run build
npm run test:e2e
```

Tests start an isolated database, API, and HTTPS preview for phone and desktop viewports.
Ports 5081 and 8443 must be free. Set `TOPOUT_E2E_API_PORT` to override the API port,
or `TOPOUT_E2E_CONFIGURATION=Release` to test a Release backend build.

After Expo dependency changes, run from `apps/app`:

```powershell
npx expo install --fix
npx expo-doctor
```

Use `npx expo install` for Expo-managed dependencies.
