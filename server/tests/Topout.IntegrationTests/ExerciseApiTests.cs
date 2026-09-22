using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Authentication;
using Topout.Application.Exercises;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[CollectionDefinition("api")]
public sealed class ApiCollection : ICollectionFixture<ApiFixture> { }

[Collection("api")]
public class ExerciseApiTests(ApiFixture fixture)
{
    internal static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter() },
    };

    internal static async Task<TokenResponse> Register(HttpClient client, string? email = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/register",
            new
            {
                email = email ?? $"{Guid.NewGuid():N}@example.com",
                password = "StrongPassword123!",
                displayName = "Climber",
            }
        );
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<TokenResponse>())!;
    }

    [Fact]
    public async Task Registration_copies_twenty_exercises_and_crud_is_isolated()
    {
        using var alice = fixture.Client();
        using var bob = fixture.Client();
        var aliceTokens = await Register(alice);
        var bobTokens = await Register(bob);
        alice.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            aliceTokens.AccessToken
        );
        bob.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            bobTokens.AccessToken
        );
        var starters = (await alice.GetFromJsonAsync<ExerciseResponse[]>("/api/exercises", Json))!;
        Assert.Equal(20, starters.Length);
        Assert.All(starters, exercise => Assert.False(exercise.IsCustom));

        var create = await alice.PostAsJsonAsync(
            "/api/exercises",
            new
            {
                name = "  Custom Row ",
                muscleGroup = "Back",
                userId = 999,
            }
        );
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var exercise = (await create.Content.ReadFromJsonAsync<ExerciseResponse>(Json))!;
        Assert.Equal("Custom Row", exercise.Name);
        Assert.True(exercise.IsCustom);
        var duplicate = await alice.PostAsJsonAsync(
            "/api/exercises",
            new { name = "custom row", muscleGroup = "Back" }
        );
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await bob.PutAsJsonAsync(
                    $"/api/exercises/{exercise.Id}",
                    new { name = "Stolen", muscleGroup = "Back" }
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await bob.DeleteAsync($"/api/exercises/{exercise.Id}")).StatusCode
        );
        Assert.DoesNotContain(
            (await bob.GetFromJsonAsync<ExerciseResponse[]>("/api/exercises", Json))!,
            x => x.Id == exercise.Id
        );
        Assert.Equal(
            HttpStatusCode.OK,
            (
                await alice.PutAsJsonAsync(
                    $"/api/exercises/{exercise.Id}",
                    new { name = "Renamed Row", muscleGroup = "Biceps" }
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await alice.DeleteAsync($"/api/exercises/{exercise.Id}")).StatusCode
        );

        // Starter copies are user-editable, and changes never affect the other account.
        var editStarter = await alice.PutAsJsonAsync(
            $"/api/exercises/{starters[0].Id}",
            new { name = "My Starter", muscleGroup = "Core" }
        );
        Assert.Equal(HttpStatusCode.OK, editStarter.StatusCode);
        Assert.True(
            (await editStarter.Content.ReadFromJsonAsync<ExerciseResponse>(Json))!.IsCustom
        );
        Assert.DoesNotContain(
            (await bob.GetFromJsonAsync<ExerciseResponse[]>("/api/exercises", Json))!,
            x => x.Name == "My Starter"
        );
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await alice.DeleteAsync($"/api/exercises/{starters[0].Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Validation_and_authentication_errors_use_problem_details()
    {
        using var client = fixture.Client();
        var unauthorized = await client.GetAsync("/api/exercises");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthorized.StatusCode);
        Assert.Equal(
            "application/problem+json",
            unauthorized.Content.Headers.ContentType?.MediaType
        );
        var tokens = await Register(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            tokens.AccessToken
        );
        foreach (
            var body in new object[]
            {
                new { name = " ", muscleGroup = "Back" },
                new { name = "Row", muscleGroup = "Invalid" },
                new { name = new string('a', 101), muscleGroup = "Back" },
                new { name = "Row", muscleGroup = 999 },
                new { name = "Row" },
            }
        )
        {
            var response = await client.PostAsJsonAsync("/api/exercises", body);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "application/problem+json",
                response.Content.Headers.ContentType?.MediaType
            );
        }
    }

    [Fact]
    public async Task Referenced_exercise_cannot_be_deleted()
    {
        using var client = fixture.Client();
        var tokens = await Register(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            tokens.AccessToken
        );
        var exercise = (await client.GetFromJsonAsync<ExerciseResponse[]>("/api/exercises", Json))![
            0
        ];
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var entity = await db.Exercises.SingleAsync(x => x.Id == exercise.Id);
            var day = new WorkoutDay(entity.UserId, "Referenced");
            day.AddExercise(entity);
            db.WorkoutDays.Add(day);
            await db.SaveChangesAsync();
        }
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/exercises/{exercise.Id}")).StatusCode
        );
    }
}
