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

## iOS TestFlight

Run EAS commands from `apps/app`, not the repository root. The production profile in
`eas.json` builds a store-signed app against the hosted HTTPS API and increments build
numbers automatically.

Before the first build:

- Confirm the iOS bundle identifier in `app.json`; it must match the Apple app record.
- The iOS icon is an opaque 1024 × 1024 PNG. Regenerate it from the SVG logo on Windows
  with `./scripts/export-ios-icon.ps1` from the repository root after changing the logo.
- Sign in to Expo and link the app to an EAS project:

```powershell
cd apps/app
npx eas-cli@latest login
npx eas-cli@latest init
```

Review the project ID added to `app.json`, then build:

```powershell
npx eas-cli@latest build --platform ios --profile production
```

Follow the Apple signing prompts; credentials should be managed through EAS, not committed.
After the build succeeds, upload it:

```powershell
npx eas-cli@latest submit --platform ios --profile production
```

Select the intended build. Complete the app-record and signing setup if prompted. In App
Store Connect, open TestFlight after processing, configure testers, and install using the
TestFlight app. Uploading to TestFlight does not publish to the public App Store.
These commands upload project source/builds to external services and may consume build quota.

For public release, separately complete the privacy disclosures, privacy policy, account
deletion, store listing, and App Review requirements. TestFlight setup is not a release audit.

See the [Expo iOS submission guide](https://docs.expo.dev/submit/ios/).

The public pages are `/privacy` and `/support`; after web deployment use
`https://topout.jackhoffsten.se/privacy` and `https://topout.jackhoffsten.se/support`
in App Store Connect. Confirm the policy matches production operations before submitting.
Account deletion is under Account, requires the current password, and permanently removes
the account and its training records. Test with a disposable account, not a real one.
Backend changes must be deployed before uploading the new app build.

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

Use `Field` for ordinary inputs and `SearchField` for inputs with results or suggestions.
On mobile web, `KeyboardViewport` handles focus after the keyboard viewport settles:
ordinary fields stay visible with a 12px margin, while result fields align below the
page header. Avoid adding screen-specific focus scrolling or scrolling on text changes.

Keyboard layout regressions, including the built login and exercise search pages, run
without the backend or Docker:

```powershell
npx playwright install chromium webkit
npm run test:keyboard
```

These tests simulate viewport changes in Chromium and WebKit. Also check opening,
switching, and dismissing the actual keyboard on an iPhone and Android device when
changing this behavior.

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
