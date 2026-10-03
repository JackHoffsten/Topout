# Backend development

The backend uses .NET 10, ASP.NET Core Identity, JWT bearer authentication, EF Core,
and PostgreSQL. Application handlers are registered directly with dependency injection.
The API owns HTTP contracts and validation; Application owns use cases and abstractions;
Infrastructure implements Identity, token issuance, repositories, and persistence.

## Local setup

Run commands from the repository root. Install the SDK selected by `global.json` and start
a Docker engine with Linux container support. The repository's `compose.yaml` runs
PostgreSQL 18.6 on localhost only, with data persisted in the
`topout-postgres-data` Docker volume.

```powershell
npm run db:up
npm run db:migrate
```

The development defaults are database `topout`, user `postgres`, password `postgres`, and
host port `5432`, matching `appsettings.Development.json`. To override them, copy
`.env.example` to `.env` and change the values before the first start. If you change the
database name, user, password, or port, update the development connection string with
user secrets as shown below. `.env` is ignored by Git; never put production secrets in it.

Check status with `docker compose ps`, follow database output with `npm run db:logs`, and
stop the database with `npm run db:down`. Stopping preserves the volume and its data.
`docker compose down --volumes` permanently deletes the development database and should
only be used when you deliberately want a clean database; rerun `npm run db:up` and
`npm run db:migrate` afterward.

Integration tests create their own disposable PostgreSQL 18 containers and do not use
this development database.

The checked-in Development configuration includes the matching connection string and a
fixed development-only JWT signing key, so no secret setup is required for local testing.
The key is public and intentionally insecure; never use it outside the Development
environment. If you customize the Docker credentials, override the connection string:

```powershell
dotnet user-secrets set "ConnectionStrings:Default" "Host=127.0.0.1;Database=topout;Username=postgres;Password=YOUR_PASSWORD" --project server/src/Topout.Api
npm run db:migrate
npm run api:dev
```

The JWT issuer, audience, and lifetimes are in appsettings.json. Outside Development, the
signing key is required at startup and must contain at least 32 UTF-8 bytes.
For deployment, use secret-managed environment variables: `Jwt__SigningKey` and
`ConnectionStrings__Default`. Use HTTPS, restrict database credentials, and do not log
authorization headers, passwords, refresh tokens, or response token bodies.

The design-time context factory reads development user secrets and environment variables
to locate the database. It never automatically applies migrations when the API starts.

## Authentication API

All endpoints accept JSON. Token responses contain accessToken, accessTokenExpiresAt,
refreshToken, and refreshTokenExpiresAt, with UTC timestamps.

- POST /api/auth/register accepts email, password, and displayName; returns 201.
- POST /api/auth/login accepts email and password; returns 200.
- POST /api/auth/refresh accepts refreshToken; returns 200 with a new token pair.
- POST /api/auth/revoke accepts refreshToken; returns 204, including for an unknown token.

Passwords require 8–128 characters, uppercase and lowercase letters, and a digit.
Display names are required and limited to 100 characters. Email/password registration
creates the account, its 20 starter exercises, and its initial session atomically.
Repeated login does not create additional exercises. Existing accounts are not backfilled
with starter copies.

JWT access tokens last 15 minutes, with 30 seconds of validation clock tolerance.
Each login creates a separate refresh-token family with an absolute 30-day expiry.
Renewal does not extend that family expiry. Only SHA-256 hashes of cryptographically
random refresh tokens are stored. Rotation locks the family in PostgreSQL, marks the old
token used, and links it to its replacement. Reusing a used token revokes its entire
family. Clients must serialize refresh requests and sign in again after a rejected
refresh; retrying an old token after a lost response also revokes the family.
Other login sessions remain active.

Revoke invalidates the refresh-token family. Already-issued access tokens remain valid
until expiry. Web/mobile clients send the access token as Authorization: Bearer TOKEN.
The JSON refresh-token transport is for native SecureStore storage. Browser clients use
GET /api/auth/web/csrf followed by POST /api/auth/web/register, /login, /refresh, or /revoke.
Registration/login bodies match their native equivalents; refresh/revoke have no body.
Browser token responses contain only accessToken and accessTokenExpiresAt.

The host-only `__Secure-topout-refresh` cookie is HttpOnly, Secure, SameSite=Lax, scoped to
/api/auth/web, and expires with the refresh family. Revoke and rejected renewal clear it.
The readable `__Host-topout-csrf` cookie contains the request verification token. All four
browser writes require X-CSRF-Token plus the matching cryptographic HttpOnly antiforgery
cookie and a trusted Origin. GET /csrf also returns csrfToken for same-site cross-origin
clients that cannot read the API host's cookie. It never returns a refresh token.

Set `Web__AllowedOrigins__0` (and subsequent indexed entries) to exact trusted frontend
origins, including scheme and port, to enable credentialed CORS. Wildcards are not used.
Use same-origin hosting or same-site HTTPS subdomains: SameSite=Lax intentionally prevents
cross-site cookie sessions. Persist ASP.NET Data Protection keys securely across restarts
and share them across replicas. Configure trusted forwarded headers at deployment; never
blindly trust public forwarding headers. See [frontend setup](frontend.md).

Authentication endpoints have a per-process, per-IP limit of 60 requests/minute, and
Identity locks accounts for 15 minutes after five failed password attempts. Configure
trusted proxy handling and distributed rate limits when deploying multiple instances.
Email verification, password recovery, and social login are later features.

## Exercise API

Every endpoint requires authentication. The user ID comes exclusively from the validated
JWT; request bodies cannot choose the account to read or modify.

- GET /api/exercises returns the current user's exercises ordered by normalized name.
- POST /api/exercises accepts name and muscleGroups; returns 201 with the created exercise.
- PUT /api/exercises/{id} replaces name and muscleGroups; returns 200.
- DELETE /api/exercises/{id} returns 204.

Responses contain id, name, muscleGroups, and isCustom. muscleGroups is an array of distinct enum strings; an empty array means unspecified. The `None` value is not accepted in this array. Existing single-group exercises are preserved by the migration.

Muscle groups are enum strings
(e.g. "Back" or "Chest"); integers and unknown values are rejected.
Names are trimmed, required, limited to 100 characters, and unique per account after
invariant uppercase normalization. Whitespace inside a name is retained.
Starter copies have isCustom=false and may be edited/deleted independently. Editing a
starter marks that user's copy as custom; it never changes another account's copy. The
client treats all exercises alike and does not expose this implementation detail in its UI.
Templates and historical logs prevent deletion of a referenced exercise.

Failures use Problem Details: 400 for invalid input, 401 for invalid authentication,
404 for missing or other-user exercises, 409 for duplicate names/referenced deletes,
and 429 for rate limiting. Unexpected errors return a generic 500 and are logged server-side.

## Workout template API

All `/api/workout-templates` endpoints require authentication and scope records to the
signed-in account. `GET` lists templates, `GET /{id}` returns one template, `POST` creates
one, `PUT /{id}` replaces its complete contents, and `DELETE /{id}` deletes it.

Create and update accept `name` and an ordered `exercises` array. Each entry contains
`exerciseId` and an ordered `sets` array. Each set contains `targetRepsMin`, optional
`targetRepsMax`, optional `targetWeightKg`, `isWarmup`, and `isAmrap`. Responses contain
`id`, `name`, and ordered entries with the full `exercise` DTO and `sets`. Array position
defines order; clients do not submit database ordering values or child IDs.

Split sets additionally contain `rightTarget` with its own `targetRepsMin`, optional
`targetRepsMax`, and optional `targetWeightKg`. The top-level targets then describe the
left side. Omit `rightTarget` or set it to null for a normal set. Warm-up and AMRAP apply
to both sides. Split weights are per side, not combined. A split set remains one logical
set when copied or reordered. The logger opens it as separate left/right results without
pre-filling actual values. The `AddSplitTemplateTargets` migration leaves existing sets
normal and preserves their targets; downgrades are rejected while split targets exist.

Names are trimmed, limited to 100 characters, and unique per account without regard to
case. Templates may be empty, and exercises may have no sets. An exercise can appear only
once per template. Reps must be 1–1000, maximum reps cannot be below minimum reps, and
optional weights must be 0–2000 kg. Blank weight means unspecified; zero is a valid target.
AMRAP marks a set as as-many-reps-as-possible while retaining its numeric target.

Create returns 201, update/read return 200, and delete returns 204. Failures use Problem
Details: 400 for invalid targets, 404 for missing or other-user records, and 409 for
duplicate names/exercises or templates referenced by scheduled workouts. Replacements
are transactional: a failed save leaves the previous template intact. Concurrent saves
are serialized, with the last successful save replacing the complete draft.

`AddWorkoutTemplateNames` backfills normalized names and adds a unique index. Before
applying it to an existing database, resolve template names that differ only by case or
surrounding spaces for the same account. Conflicting data causes a transactional failure;
the migration does not remove templates or their contents.

## Workout schedule API

The authenticated workout schedule API uses the existing ScheduledWorkout table:

- `GET /api/workout-schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` lists the current user's
  entries in an inclusive range of at most 63 days.
- `POST /api/workout-schedule` accepts `{ "date": "2026-10-02", "templateId": 1 }`.
  A null templateId records a rest day. Multiple entries per date are allowed.
- `DELETE /api/workout-schedule/{id}` removes an owned entry only when it has no workout log. Unfinished and completed logs both prevent removal (409). Missing and other-user entries or templates return 404.

Rest days cannot share a date with workout plans; conflicting requests return 409. Remove
the existing plan first. Multiple workout plans can still share a date.

Dates are date-only values. Scheduling references a live template rather than copying its
contents; referenced templates retain the existing deletion restriction. No migration is
needed for calendar planning.

## Workout logging API

- `GET /api/workout-schedule/{id}/log` returns the scheduled date, current template, and
  saved log (unfinished or completed) if one exists.
  `previousSets` contains the latest saved result per exercise, set order, and side from other
  workouts belonging to the current user. Workouts after the selected date are excluded;
  same-date records use the newest log ID. Unfinished logs are included, and deleting a
  log removes it from future reference results.
- `POST /api/workout-schedule/{id}/log` completes the workout with a request like:

```json
{
  "notes": null,
  "exercises": [
    {
      "exerciseId": 1,
      "sets": [{ "reps": 8, "weightKg": 20, "isWarmup": false, "notes": null }]
    }
  ]
}
```

- `PUT /api/workout-schedule/{id}/log` replaces a completed record with the same full
  request shape. The log ID and original completion timestamp are preserved.
- `PUT /api/workout-schedule/{id}/log/sets` records or updates one set with `exerciseId`,
  `order` (1–100), `reps`, `weightKg`, `isWarmup`, and nullable `notes`. It creates an
  unfinished log on first use and works for completed logs as well.
- `DELETE /api/workout-schedule/{id}/log/sets/{exerciseId}/{order}?side=Left` removes one side of a saved set. Omit `side` for a normal set.
- `DELETE /api/workout-schedule/{id}/log` permanently removes the entire owned log and its
  sets and notes, returning 204. The plan is retained and reset to Planned. Missing logs
  and other-user schedules return 404.
  Deleting the last set of a completed workout returns 409.

Saved sets include their stable order in responses. Unfinished logs have null completedAt;
their calendar status is InProgress. Empty planned slots are not stored as actual sets.

At least one exercise and one set per exercise are required. Reps must be integers from
1–1000; weight must be 0–2000 kg. Notes allow up to 2000 characters. Limits are 100 exercises
and 100 logical sets per exercise (up to 200 side results). Set inputs accept `side` (`Both`, `Left`, or `Right`, default `Both`) and an optional `order` (1–100). Without an explicit order, array positions determine ordering. A split set has left/right results sharing one order; their weights are per side, not combined. Duplicate sides or a normal result mixed with side results at the same order return 400. To change the split mode of an already saved set through the individual-set endpoint, remove the old result first (409 otherwise); completed-log replacement can change the mode atomically.

`AddLoggedSetSides` preserves existing sets as `Both`. Downgrading is rejected while side results exist, to prevent accidental loss of unilateral data.

Duplicate exercises return
409; unavailable or other-user exercises and schedules return 404. Rest days and completed
workouts cannot be completed again via POST; corrections use PUT. All operations require authentication.

Actual sets and schedule completion are saved in one transaction. A row lock serializes
completion, set updates, completed edits, and removal. Updating the same set twice replaces
its values rather than duplicating it. Completion of an unfinished log reuses its ID.
The existing workout-log tables support this feature without a migration.

The isolated browser test server opts into a larger authentication rate-limit budget with
`Testing:ExpandedAuthRateLimit`. This setting is honored only in the Testing environment;
production and development retain the normal limit of 60 requests per IP per minute.

## Climbing logs

Authenticated, user-scoped climbing endpoints:

- `GET /api/climb-logs?from=2026-10-01&to=2026-10-31` lists a maximum 63-day range.
- `GET /api/climb-logs/history?page=1&pageSize=50` returns `{ items, nextPage, totalCount }` across all dates, newest date then newest ID first. `totalCount` counts all the account's climbs, irrespective of filtering or pagination. Page sizes are 1–100; `nextPage` is null at the end.
  Optional history query parameters: `sort` (`date-desc`, `date-asc`, `grade-desc`, `grade-asc`), `climbingType`, `gradeSystem`, `grade`, `environment`, `outcome`, `wallAngle`, `style`, `search` (name/location), and inclusive `from`/`to` dates. An exact `grade` requires its `gradeSystem`; incompatible grades return 400. Filtering and sorting precede pagination. Grade order uses each system's difficulty ladder, grouped by grading system rather than comparing unrelated scales.
  Category parameters accept repeated values, for example `environment=Indoor&environment=Outdoor`. Values within a category use OR; categories combine with AND. Style matches any selected tag. Each selected grade must belong to at least one selected grading system. Empty selections do not restrict results.
- `GET /api/climb-logs/{id}` fetches one owned log; missing and other-user logs return 404.
- `POST /api/climb-logs` creates a log (201).
- `PUT /api/climb-logs/{id}` replaces the complete log (200).
- `DELETE /api/climb-logs/{id}` permanently deletes the log (204).

Example input:

```json
{
  "date": "2026-10-03",
  "climbingType": "Bouldering",
  "gradeSystem": "Font",
  "grade": "7A",
  "environment": "Indoor",
  "attempts": 3,
  "outcome": "Redpoint",
  "wallAngle": "Overhang",
  "styles": ["Crimpy", "Slopy"],
  "name": null,
  "location": null
}
```

Responses contain the same fields plus `id`. Each entry represents one route/problem on
one date; multiple climbs with identical grades are allowed. Attempts count that day's
tries, not lifetime attempts. `Attempted` records an unsent climb; `Redpoint`, `Flash`, and
`Onsight` record completed climbs. Flash/onsight require exactly one attempt that day;
the user remains responsible for indicating whether there were earlier attempts or beta.

`Bouldering` supports `Font` (uppercase, e.g. `7A`) and `V`. `Sport` and `TopRope` support
`French` (lowercase, e.g. `7a`) and `YDS`. Original grades are stored without conversion.
Environments are `Indoor`, `Outdoor`, and `Board` (bouldering only). Wall angle may be
null or `Slab`, `Vertical`, `Overhang`, or `Roof`. Styles are a distinct array selected
from `Crimpy`, `Slopy`, `Juggy`, `Pinchy`, `Technical`, `Powerful`, `Dynamic`, `Balance`,
and `Endurance`. Attempts are integers 1–1000. Optional name/location are trimmed, limited
to 100/200 characters, and stored as null when empty.

Invalid input returns 400 Problem Details. Missing and other-user logs return 404.
Rest-day dates reject climb creation/moves with 409, and dates with climbing logs reject
rest-day creation. A shared per-user/date PostgreSQL transaction lock serializes these
checks. Gym plans and climbing logs may share a date. `AddClimbingLogs` adds an independent
table without changing existing gym data.

Grading references: [BMC indoor climbing grades](https://thebmc.co.uk/en/indoor-climbing-grades-explained)
and [UIAA grading scales](https://theuiaa.org/documents/mountaineering/THESCALESOFDIFFICULTYINCLIMBING_p1b.pdf).

## Progress API

`GET /api/progress?from=YYYY-MM-DD&to=YYYY-MM-DD` is authenticated and scoped to the
current account. Both inclusive date bounds are optional; reversed or invalid bounds return
400 Problem Details. The response contains `exercises` and `climbing` daily summaries,
never other accounts' data. Empty history returns two empty arrays.

Exercise rows contain date, exercise ID/name, side, working-set count, total reps,
maximum weight in kilograms, and total weight × reps. Warm-ups are excluded; incomplete
workouts are included. Climbing rows are grouped by date/type/system/grade/environment,
with climb, send, flash, and attempt totals. Unsent climbs contribute to climb/attempt
counts but not send/flash counts. Aggregation runs in PostgreSQL and requires no migration.

## Migrations and tests

The original migration is preserved. AddExerciseCatalogAndRefreshSessions adds normalized
names, exercise origin, unique email enforcement, and refresh-session/token tables.
Existing exercises are marked custom and their normalized names are backfilled.
Before upgrading populated databases, resolve same-user names differing only by case,
duplicate normalized emails, or display names over 100 characters. Such incompatible data
causes the migration to fail transactionally; it is never silently merged or discarded.

```powershell
dotnet test server/Topout.sln -m:1
dotnet ef migrations has-pending-model-changes --project server/src/Topout.Infrastructure --startup-project server/src/Topout.Api --no-build
dotnet tool restore
dotnet tool run csharpier -- check server/src/Topout.Api server/src/Topout.Application server/tests
```

Unit tests cover domain invariants and user-scoped handlers. PostgreSQL tests cover
migration upgrades, constraints, unsaved aggregate graphs, set reordering, transactional
registration rollback, authenticated CRUD, account isolation, JWT validation, refresh
expiry/rotation/reuse, and concurrent renewal. Docker tests never use the development
database or its credentials.

References: [JWT bearer validation](https://learn.microsoft.com/en-us/aspnet/core/security/authentication/configure-jwt-bearer-authentication?view=aspnetcore-10.0)
and [PostgreSQL Testcontainers](https://dotnet.testcontainers.org/modules/postgres/).
