# Backend development

The backend uses .NET 10, ASP.NET Core Identity, JWT bearer authentication, EF Core,
and PostgreSQL. Application handlers are registered directly with dependency injection.
The API owns HTTP contracts and validation; Application owns use cases and abstractions;
Infrastructure implements Identity, token issuance, repositories, and persistence.

## Local setup

Run commands from the repository root. Install the SDK selected by global.json and
start PostgreSQL. Integration tests use Docker Desktop with Linux containers and create
their own disposable PostgreSQL 18 databases.

Configure a development connection string and a randomly generated signing secret:

```powershell
dotnet user-secrets set "ConnectionStrings:Default" "Host=localhost;Database=topout;Username=postgres;Password=YOUR_PASSWORD" --project server/src/Topout.Api
$jwtSecret = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(64))
dotnet user-secrets set "Jwt:SigningKey" $jwtSecret --project server/src/Topout.Api
dotnet build server/Topout.sln -m:1
dotnet ef database update --project server/src/Topout.Infrastructure --startup-project server/src/Topout.Api
dotnet run --project server/src/Topout.Api -- --environment Development --urls https://localhost:7043
```

Trust the ASP.NET development certificate if HTTPS is not already configured.
The JWT issuer, audience, and lifetimes are in appsettings.json. The signing key is
required at startup and must contain at least 32 UTF-8 bytes; generate a random value.
For deployment, use secret-managed environment variables: Jwt__SigningKey and
ConnectionStrings__Default. Use HTTPS, restrict database credentials, and do not log
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
The current JSON refresh-token transport is intended for secure client storage. For the
browser frontend, implement an HttpOnly secure-cookie/BFF flow with CSRF protection
before persisting sessions; do not put refresh tokens in localStorage.
No frontend token-storage code is included in this slice.

Authentication endpoints have a per-process, per-IP limit of 60 requests/minute, and
Identity locks accounts for 15 minutes after five failed password attempts. Configure
trusted proxy handling and distributed rate limits when deploying multiple instances.
Email verification, password recovery, and social login are later features.

## Exercise API

Every endpoint requires authentication. The user ID comes exclusively from the validated
JWT; request bodies cannot choose the account to read or modify.

- GET /api/exercises returns the current user's exercises ordered by normalized name.
- POST /api/exercises accepts name and muscleGroup; returns 201 with the created exercise.
- PUT /api/exercises/{id} replaces name and muscleGroup; returns 200.
- DELETE /api/exercises/{id} returns 204.

Responses contain id, name, muscleGroup, and isCustom. Muscle groups are enum strings
(e.g. "Back" or "Chest"); integers and unknown values are rejected.
Names are trimmed, required, limited to 100 characters, and unique per account after
invariant uppercase normalization. Whitespace inside a name is retained.
Starter copies have isCustom=false and may be edited/deleted independently.
Client-created exercises have isCustom=true; editing does not change their origin.
Templates and historical logs prevent deletion of a referenced exercise.

Failures use Problem Details: 400 for invalid input, 401 for invalid authentication,
404 for missing or other-user exercises, 409 for duplicate names/referenced deletes,
and 429 for rate limiting. Unexpected errors return a generic 500 and are logged server-side.

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
