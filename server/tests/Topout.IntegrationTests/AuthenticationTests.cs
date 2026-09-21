using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Authentication;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class AuthenticationTests(ApiFixture fixture)
{
    [Fact]
    public async Task Concurrent_registration_creates_only_one_account_and_catalog()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        var request = new
        {
            email,
            password = "StrongPassword123!",
            displayName = "Concurrent",
        };
        var responses = await Task.WhenAll(
            client.PostAsJsonAsync("/api/auth/register", request),
            client.PostAsJsonAsync("/api/auth/register", request)
        );
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Conflict);
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = Assert.Single(await db.Users.Where(x => x.Email == email).ToArrayAsync());
        Assert.Equal(20, await db.Exercises.CountAsync(x => x.UserId == user.Id));
    }

    [Fact]
    public async Task Repeated_bad_passwords_lock_the_account()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        await ExerciseApiTests.Register(client, email);
        for (var i = 0; i < 5; i++)
            Assert.Equal(
                HttpStatusCode.Unauthorized,
                (
                    await client.PostAsJsonAsync(
                        "/api/auth/login",
                        new { email, password = "WrongPassword" }
                    )
                ).StatusCode
            );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync(
                    "/api/auth/login",
                    new { email, password = "StrongPassword123!" }
                )
            ).StatusCode
        );
    }

    [Fact]
    public async Task Login_rotation_replay_and_revoke_preserve_session_isolation()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        var first = await ExerciseApiTests.Register(client, email);
        var login = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email, password = "StrongPassword123!" }
        );
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var second = (await login.Content.ReadFromJsonAsync<TokenResponse>())!;
        Assert.True(first.AccessTokenExpiresAt < first.RefreshTokenExpiresAt);
        var rotatedResponse = await client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { first.RefreshToken }
        );
        Assert.Equal(HttpStatusCode.OK, rotatedResponse.StatusCode);
        var rotated = (await rotatedResponse.Content.ReadFromJsonAsync<TokenResponse>())!;
        Assert.NotEqual(first.RefreshToken, rotated.RefreshToken);
        Assert.Equal(first.RefreshTokenExpiresAt, rotated.RefreshTokenExpiresAt);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { first.RefreshToken })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { rotated.RefreshToken })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.OK,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { second.RefreshToken })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NoContent,
            (
                await client.PostAsJsonAsync("/api/auth/revoke", new { second.RefreshToken })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { second.RefreshToken })
            ).StatusCode
        );
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.RefreshTokens.AnyAsync(x => x.TokenHash == first.RefreshToken));
        Assert.All(
            await db.RefreshTokens.Select(x => x.TokenHash).ToArrayAsync(),
            hash => Assert.Equal(64, hash.Length)
        );
    }

    [Fact]
    public async Task Concurrent_refresh_allows_only_one_rotation_and_revokes_the_family_on_reuse()
    {
        using var client = fixture.Client();
        var original = await ExerciseApiTests.Register(client);
        var responses = await Task.WhenAll(
            client.PostAsJsonAsync("/api/auth/refresh", new { original.RefreshToken }),
            client.PostAsJsonAsync("/api/auth/refresh", new { original.RefreshToken })
        );
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, x => x.StatusCode == HttpStatusCode.Unauthorized);
        var successor = (
            await responses
                .Single(x => x.IsSuccessStatusCode)
                .Content.ReadFromJsonAsync<TokenResponse>()
        )!;
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { successor.RefreshToken })
            ).StatusCode
        );
    }

    [Fact]
    public async Task Duplicate_registration_and_bad_credentials_have_expected_errors()
    {
        using var client = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        await ExerciseApiTests.Register(client, email);
        var duplicate = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = email.ToUpperInvariant(),
                password = "StrongPassword123!",
                displayName = "Again",
            }
        );
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync(
                    "/api/auth/login",
                    new { email, password = "WrongPassword" }
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (
                await client.PostAsJsonAsync(
                    "/api/auth/register",
                    new
                    {
                        email = "bad",
                        password = "short",
                        displayName = " ",
                    }
                )
            ).StatusCode
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            "invalid-token"
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/exercises")).StatusCode
        );
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await db.Users.SingleAsync(x => x.Email == email);
        Assert.Equal(20, await db.Exercises.CountAsync(x => x.UserId == user.Id));
    }

    [Fact]
    public async Task Expired_refresh_token_is_rejected()
    {
        using var client = fixture.Client();
        var tokens = await ExerciseApiTests.Register(client);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hash = Convert.ToHexString(
                System.Security.Cryptography.SHA256.HashData(
                    System.Text.Encoding.UTF8.GetBytes(tokens.RefreshToken)
                )
            );
            var token = await db.RefreshTokens.SingleAsync(x => x.TokenHash == hash);
            token.ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            await db.SaveChangesAsync();
        }
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync("/api/auth/refresh", new { tokens.RefreshToken })
            ).StatusCode
        );
    }
}
