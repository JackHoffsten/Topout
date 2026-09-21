using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Topout.Application.Authentication;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Infrastructure.Persistence;

namespace Topout.Infrastructure.Identity;

internal sealed class AuthenticationService(
    AppDbContext db,
    UserManager<ApplicationUser> users,
    SignInManager<ApplicationUser> signIn,
    TokenIssuer issuer,
    IOptions<JwtOptions> options,
    TimeProvider clock
) : IAuthenticationService
{
    public async Task<TokenResponse> RegisterAsync(
        string email,
        string password,
        string displayName,
        CancellationToken ct
    )
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var user = new ApplicationUser
        {
            UserName = email.Trim(),
            Email = email.Trim(),
            DisplayName = displayName.Trim(),
        };
        var result = await users.CreateAsync(user, password);
        if (!result.Succeeded)
        {
            var duplicate = result.Errors.Any(x =>
                x.Code is "DuplicateEmail" or "DuplicateUserName"
            );
            throw new RequestException(
                duplicate ? ErrorKind.Conflict : ErrorKind.Validation,
                duplicate
                    ? "An account with this email already exists."
                    : "The password does not meet the account requirements."
            );
        }
        db.Exercises.AddRange(StarterExercises.CreateFor(user.Id));
        var response = CreateSession(user.Id);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return response;
    }

    public async Task<TokenResponse> LoginAsync(string email, string password, CancellationToken ct)
    {
        var user = await users.FindByEmailAsync(email.Trim());
        if (user is null)
            throw InvalidCredentials();
        var result = await signIn.CheckPasswordSignInAsync(user, password, lockoutOnFailure: true);
        if (!result.Succeeded)
            throw InvalidCredentials();
        user.LastLoginAt = clock.GetUtcNow().UtcDateTime;
        var response = CreateSession(user.Id);
        await db.SaveChangesAsync(ct);
        return response;
    }

    public async Task<TokenResponse> RefreshAsync(string refreshToken, CancellationToken ct)
    {
        var hash = TokenIssuer.Hash(refreshToken);
        var existing = await db
            .RefreshTokens.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (existing is null)
            throw InvalidRefresh();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        // Lock the family, then reread the token. A simultaneous refresh/revoke must see the committed rotation.
        var session = await LockSessionAsync(existing.SessionId, ct);
        var token = await db.RefreshTokens.SingleAsync(x => x.Id == existing.Id, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        if (session.RevokedAt is not null || session.ExpiresAt <= now || token.ExpiresAt <= now)
            throw InvalidRefresh();
        if (token.RevokedAt is not null)
        {
            session.RevokedAt = now;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            throw InvalidRefresh();
        }
        var user = await users.FindByIdAsync(session.UserId.ToString());
        if (user is null || await users.IsLockedOutAsync(user))
            throw InvalidRefresh();
        var issued = issuer.Issue(session.UserId, session);
        db.RefreshTokens.Add(issued.Token);
        token.RevokedAt = now;
        token.ReplacedById = issued.Token.Id;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return issued.Response;
    }

    public async Task RevokeAsync(string refreshToken, CancellationToken ct)
    {
        var hash = TokenIssuer.Hash(refreshToken);
        var token = await db
            .RefreshTokens.AsNoTracking()
            .SingleOrDefaultAsync(x => x.TokenHash == hash, ct);
        if (token is null)
            return; // Idempotent, and does not disclose whether a token exists.
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var session = await LockSessionAsync(token.SessionId, ct);
        session.RevokedAt ??= clock.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    private Task<RefreshSession> LockSessionAsync(Guid id, CancellationToken ct) =>
        db
            .RefreshSessions.FromSqlInterpolated(
                $"""SELECT * FROM "RefreshSessions" WHERE "Id" = {id} FOR UPDATE"""
            )
            .SingleAsync(ct);

    private TokenResponse CreateSession(int userId)
    {
        // Match a precision PostgreSQL preserves so renewal returns the same family expiry.
        var now = DateTimeOffset
            .FromUnixTimeMilliseconds(clock.GetUtcNow().ToUnixTimeMilliseconds())
            .UtcDateTime;
        var session = new RefreshSession
        {
            UserId = userId,
            CreatedAt = now,
            ExpiresAt = now.AddDays(options.Value.RefreshTokenDays),
        };
        var issued = issuer.Issue(userId, session);
        db.RefreshSessions.Add(session);
        db.RefreshTokens.Add(issued.Token);
        return issued.Response;
    }

    private static RequestException InvalidCredentials() =>
        new(ErrorKind.Unauthorized, "Invalid email or password.");

    private static RequestException InvalidRefresh() =>
        new(ErrorKind.Unauthorized, "Invalid or expired refresh token.");
}
