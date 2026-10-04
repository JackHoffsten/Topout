using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Domain.Entities;
using Topout.Domain.ValueObjects;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class AccountApiTests(ApiFixture fixture)
{
    [Fact]
    public async Task Deletion_requires_password_removes_nested_data_and_invalidates_all_sessions()
    {
        using var client = fixture.Client();
        using var other = fixture.Client();
        var email = $"{Guid.NewGuid():N}@example.com";
        var session = await ExerciseApiTests.Register(client, email);
        var otherSession = await ExerciseApiTests.Register(other);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            session.AccessToken
        );
        other.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            otherSession.AccessToken
        );
        var secondLogin = await client.PostAsJsonAsync(
            "/api/auth/login",
            new { email, password = "StrongPassword123!" }
        );
        var second = (
            await secondLogin.Content.ReadFromJsonAsync<Topout.Application.Authentication.TokenResponse>()
        )!;
        // Rotate a token to exercise the token family's self-referencing foreign key on deletion.
        var refresh = await client.PostAsJsonAsync(
            "/api/auth/refresh",
            new { refreshToken = session.RefreshToken }
        );
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        int userId;
        int templateId;
        int logId;
        Guid[] tokenIds;
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            userId = (await db.Users.SingleAsync(x => x.Email == email)).Id;
            var exercise = await db.Exercises.FirstAsync(x => x.UserId == userId);
            var template = new WorkoutDay(userId, "Deletion test");
            template.AddExercise(exercise).AddSet(8, Weight.FromKilograms(20));
            var log = new WorkoutLog(userId, new DateOnly(2026, 10, 4), "Private notes");
            log.AddEntry(exercise).AddSet(8, Weight.FromKilograms(20));
            log.Complete(DateTime.UtcNow);
            var plan = new ScheduledWorkout(userId, log.Date, template);
            plan.AttachLog(log);
            var climb = new ClimbLog(userId);
            climb.Update(
                log.Date,
                "Bouldering",
                "Font",
                "7A",
                "Indoor",
                1,
                "Flash",
                null,
                [],
                "Private climb",
                null
            );
            db.ScheduledWorkouts.Add(plan);
            db.ClimbLogs.Add(climb);
            await db.SaveChangesAsync();
            templateId = template.Id;
            logId = log.Id;
            tokenIds = await db
                .RefreshTokens.Where(x =>
                    db.RefreshSessions.Any(s => s.Id == x.SessionId && s.UserId == userId)
                )
                .Select(x => x.Id)
                .ToArrayAsync();
        }
        var wrong = await Delete(client, "WrongPassword123!");
        Assert.Equal(HttpStatusCode.BadRequest, wrong.StatusCode);
        Assert.Equal("application/problem+json", wrong.Content.Headers.ContentType?.MediaType);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/exercises")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await Delete(client, "StrongPassword123!")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/exercises")).StatusCode
        );
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            second.AccessToken
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/exercises")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await client.PostAsJsonAsync(
                    "/api/auth/refresh",
                    new { refreshToken = second.RefreshToken }
                )
            ).StatusCode
        );
        Assert.Equal(HttpStatusCode.OK, (await other.GetAsync("/api/exercises")).StatusCode);
        using var verifyScope = fixture.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await verify.Users.AnyAsync(x => x.Id == userId));
        Assert.False(await verify.Exercises.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.ScheduledWorkouts.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.WorkoutDays.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.WorkoutLogs.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.ClimbLogs.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.WorkoutDayExercises.AnyAsync(x => x.WorkoutDayId == templateId));
        Assert.False(await verify.WorkoutLogEntries.AnyAsync(x => x.WorkoutLogId == logId));
        Assert.False(await verify.RefreshSessions.AnyAsync(x => x.UserId == userId));
        Assert.False(await verify.RefreshTokens.AnyAsync(x => tokenIds.Contains(x.Id)));
        // The deleted email is available for registration again.
        await ExerciseApiTests.Register(client, email);
    }

    [Fact]
    public async Task Anonymous_deletion_is_rejected()
    {
        using var client = fixture.Client();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await Delete(client, "StrongPassword123!")).StatusCode
        );
    }

    private static Task<HttpResponseMessage> Delete(HttpClient client, string password) =>
        client.SendAsync(
            new HttpRequestMessage(HttpMethod.Delete, "/api/account")
            {
                Content = JsonContent.Create(new { password }),
            }
        );
}
