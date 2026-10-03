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

Filter categories support multiple selections. Click a value again to deselect it, or
choose All to clear that category. Results match any selected value within each category,
and must match all active categories. Apply saves the draft; Close hides it without applying.

- `app` — public and protected Expo Router routes
- `src/features` — authentication and exercise features
- `src/lib` — session and query providers
- `src/ui` — design tokens, reusable components, and responsive navigation
- `packages/shared` — runtime-validated DTOs, API client, and session transports

TanStack Query manages server state in memory. Exercise mutations invalidate the exercise
list. Exercise data and pending mutations are not persisted offline.

The exercise library has independent name/muscle-group search, name sorting (A–Z or
Z–A), and muscle-group filters. Filters and search combine across
the complete library; resetting filters preserves search. Starter and custom exercises
remain visually identical.

## Authentication behavior

Access tokens are held in memory on every platform.

Native refresh tokens are stored with Expo SecureStore. Browser refresh tokens remain in
server-managed HttpOnly cookies and are never stored in localStorage, sessionStorage,
IndexedDB, or JavaScript application state.

Session renewal is single-flight within a client. Browser tabs use Web Locks to coordinate
refresh-token rotation and BroadcastChannel to propagate logout. A request is replayed at
most once after successful renewal. Failed renewal clears the local session.

## Calendar calendar

`/calendar` opens after sign-in and shows a Monday-first month calendar. Select a date and use
Plan workout to search and select a template. Multiple workouts can be planned on a date.
Add rest day records a rest-day entry. Plans are saved to the API and survive reloads.
Select an entry's Remove button to remove it after confirmation; the template is kept.
Calendar dates use local dates without converting them to UTC.

The calendar references the current template, so editing a template changes the plan shown
for future sessions. Scheduled templates cannot be deleted until their calendar entries
are removed.

## Workout logging

Select a planned workout on Calendar and choose Log workout. The editor shows planned targets
as a reference, with blank fields for actual reps and kilograms. Enter 0 kg for bodyweight
sets. When a matching exercise and set number has a previous saved record, Last logged
shows its date, reps, kilograms, and warm-up flag instead of planned targets. This uses
the latest workout date on or before the selected date, excludes the current workout,
and includes unfinished saved logs. Actual inputs are not prefilled from history.
Add or remove sets and exercises to match the workout actually performed, and add
warm-up flags or optional notes. Adding a set copies the previous weight, leaving reps blank.

Log set saves an individual set immediately; Logged indicates its values are saved. Changing
those values enables Save set. The calendar shows In progress and Resume workout, and saved
sets are restored after reload. Unsaved planned slots remain blank. Removing a saved set is
also persisted immediately. Finish workout saves entered sets and marks the entry Completed;
blank, unlogged sets are skipped. At least one valid set is required.

Use View workout log and Edit workout to correct a completed record. Save changes saves the
entire edited workout, including notes and exercise changes, while keeping its original log ID
and completion timestamp. Individual set corrections can also be saved with Save set. A
completed workout must retain at least one set. Dates with saved sets show a check mark
(“Logged” on desktop), including unfinished workouts. Calendar entries with logs cannot
be removed until their logs are removed.

On Calendar, Remove log permanently deletes that workout's sets and notes after confirmation,
but keeps the template planned on the date. Remove then removes the calendar plan without
deleting the template. Rest days cannot be added to dates with workout plans; remove all
plans first. Likewise, remove a rest day before planning workouts on that date.
Recorded values remain separate from template targets.

Cancel discards only unsaved edits; previously logged sets remain. Unlogged field edits,
workout notes, and pending exercise changes are saved when finishing or saving changes, not
by the individual set action. This slice does not include timers or offline storage.

## Workout templates

The template list starts collapsed with names and exercise/set counts. Expand a template
to see its exercises, planned targets (including left/right split sets), and edit/delete
controls. The independent search field matches template and exercise names. Sort by name
in either direction; filters select a muscle group. Filtering and sorting cover the complete template
list. Resetting filters preserves the search text.

Use **Templates** to create reusable exercise plans. Select **Add exercise** and choose an
exercise from the searchable dropdown. Edit its sets, then select **Add exercise** to
confirm it or **Cancel** to discard that exercise draft. Confirmed exercises collapse to
their name and set count; select the header to expand them. Move buttons work while
collapsed, and set ordering is available when expanded. Each newly added exercise
starts with two sets of 8 reps. Adding another set copies the previous set; when there are
no sets, it starts with 8 reps and no weight. All fields remain editable.

Reps specifies an exact target unless Max reps is entered, in which case the two fields
define a range. Weight is optional and uses kilograms. Warm-up and AMRAP are independent
set flags. Templates can be saved without exercises or sets. Changes remain in the editor
until Save is selected, and failed saves preserve the draft. Cancel asks before discarding
an edited draft. Drafts are not persisted across page reloads.

Template management does not start a workout or schedule a date. Exercises referenced by
templates cannot be deleted until removed from the templates. Templates referenced by
scheduled workouts cannot be deleted.

## Climbing

On Calendar, select a calendar date and choose **Log climb** to open the dedicated
`/climbs/new` screen. The selected date is prefilled and editable. Saving or cancelling
returns to that calendar date. **Log climb** is also available from climb history,
defaults to today, and returns to history. Select bouldering, sport, or
top rope; the grade picker offers the matching grading systems. Search and select a
grade, choose an environment/outcome, and enter attempts for that day. Wall angle,
multiple style tags, route name, and location are optional. Save each route/problem
separately, including unsuccessful attempts. Logs can be edited or deleted from the
selected date. Square icon badges mark dates with climbing logs on phone and desktop.
Calendar summaries show name, grade, attempts, and outcome. Select a climb to open `/climbs`
with that record expanded, or use **All climbs** to browse the full history. History loads
newest-first pages; the **Climbs** navigation item also opens history directly. Choose
Newest/Oldest or Hardest/Easiest sorting. Grade sorting follows difficulty within each
grading system without converting between scales. The always-visible search field searches
names and locations as you type, independently of the filters panel. **Filters** includes
type, grade system, exact grade, environment, outcome, wall angle, style, and inclusive date
ranges. Apply filters to search all records, not only loaded pages; use Reset filters to
clear them without clearing the search text. Choose a grade system to enable the searchable
grade picker; changing the system clears the selected grade. Expand a record for its date, climbing type, grade system, environment,
wall angle, styles, location, and edit/delete controls. Selected records load independently
of pagination, so older climbs can be opened directly.

Rest days must be removed before adding climbing logs, and climbing logs must be removed
before adding a rest day. Gym plans can coexist with climbs. Grades are not converted
between scales; the original grading system is retained.

Apply database migrations with `npm run db:migrate` and restart the API before testing
this feature. The isolated phone/desktop flow is `npx playwright test e2e/climbing.spec.ts`
(build the frontend first).

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
and test desktop and phone layouts. Ports `5081` and `8443` must be available. Build the
backend before running Playwright. Tests use the Debug build by default; set
`TOPOUT_E2E_CONFIGURATION=Release` to use a Release build. `TOPOUT_E2E_API_PORT` overrides
the test API port when needed.

Install the Playwright browser when needed:

```powershell
npx playwright install chromium
```
