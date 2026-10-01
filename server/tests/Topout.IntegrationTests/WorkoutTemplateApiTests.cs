using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class WorkoutTemplateApiTests(ApiFixture fixture)
{
    private const string Url = "/api/workout-templates";
    private static readonly PlannedSetInput Set = new(8, 12, 20.5m, true, true);

    private async Task<HttpClient> Client()
    {
        var client = fixture.Client();
        var session = await ExerciseApiTests.Register(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            session.AccessToken
        );
        return client;
    }

    private static async Task<ExerciseResponse[]> Exercises(HttpClient client) =>
        (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!;

    private static async Task<WorkoutTemplateResponse> Read(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<WorkoutTemplateResponse>(ExerciseApiTests.Json))!;

    [Fact]
    public async Task Crud_preserves_targets_order_and_empty_templates()
    {
        using var client = await Client();
        var exercises = await Exercises(client);
        var input = new WorkoutTemplateInput(
            "  Push  ",
            [new(exercises[0].Id, [Set, Set with { TargetRepsMin = 5 }]), new(exercises[1].Id, [])]
        );
        var created = await client.PostAsJsonAsync(Url, input);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var template = await Read(created);
        Assert.Equal("Push", template.Name);
        Assert.Equal(Set, template.Exercises[0].Sets[0]);
        var update = input with
        {
            Name = "Pull",
            Exercises =
            [
                input.Exercises[1],
                input.Exercises[0] with
                {
                    Sets = input.Exercises[0].Sets.Reverse().ToArray(),
                },
            ],
        };
        var saved = await client.PutAsJsonAsync($"{Url}/{template.Id}", update);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var loaded = await Read(await client.GetAsync($"{Url}/{template.Id}"));
        Assert.Equal(exercises[1].Id, loaded.Exercises[0].Exercise.Id);
        Assert.Empty(loaded.Exercises[0].Sets);
        Assert.Equal(5, loaded.Exercises[1].Sets[0].TargetRepsMin);
        Assert.Equal(8, loaded.Exercises[1].Sets[1].TargetRepsMin);
        Assert.Single(
            (await client.GetFromJsonAsync<WorkoutTemplateResponse[]>(Url, ExerciseApiTests.Json))!
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/exercises/{exercises[0].Id}")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.OK,
            (
                await client.PutAsJsonAsync(
                    $"{Url}/{template.Id}",
                    new WorkoutTemplateInput("Empty", [])
                )
            ).StatusCode
        );
        Assert.Empty((await Read(await client.GetAsync($"{Url}/{template.Id}"))).Exercises);
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"{Url}/{template.Id}")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"{Url}/{template.Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Ownership_validation_and_failed_updates_preserve_original()
    {
        using var client = await Client();
        using var other = await Client();
        var exercise = (await Exercises(client))[0];
        var foreign = (await Exercises(other))[0];
        var input = new WorkoutTemplateInput("Original", [new(exercise.Id, [Set])]);
        var template = await Read(await client.PostAsJsonAsync(Url, input));
        var path = $"{Url}/{template.Id}";
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(path)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.PutAsJsonAsync(path, input)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync(path)).StatusCode);
        Assert.Empty(
            (await other.GetFromJsonAsync<WorkoutTemplateResponse[]>(Url, ExerciseApiTests.Json))!
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await client.PutAsJsonAsync(path, input with { Exercises = [new(foreign.Id, [])] })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync(Url, input with { Name = " original " })).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(
                    path,
                    input with
                    {
                        Exercises = [input.Exercises[0], input.Exercises[0]],
                    }
                )
            ).StatusCode
        );
        foreach (
            var invalid in new[]
            {
                Set with
                {
                    TargetRepsMin = 0,
                },
                Set with
                {
                    TargetRepsMax = 7,
                },
                Set with
                {
                    TargetWeightKg = -1,
                },
                Set with
                {
                    TargetRepsMin = 1001,
                },
                Set with
                {
                    TargetWeightKg = 2001,
                },
            }
        )
        {
            var response = await client.PutAsJsonAsync(
                path,
                input with
                {
                    Name = "Changed",
                    Exercises = [new(exercise.Id, [invalid])],
                }
            );
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            Assert.Equal(
                "application/problem+json",
                response.Content.Headers.ContentType?.MediaType
            );
        }
        // Failure after deleting old children must also roll back the entire replacement.
        await client.PostAsJsonAsync(Url, new WorkoutTemplateInput("Taken", []));
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(path, input with { Name = "taken", Exercises = [] })
            ).StatusCode
        );
        var original = await Read(await client.GetAsync(path));
        Assert.Equal("Original", original.Name);
        Assert.Equal(Set, original.Exercises.Single().Sets.Single());
        using var anonymous = fixture.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(Url)).StatusCode);
    }

    [Fact]
    public async Task Scheduled_template_delete_is_rejected_and_unique_names_are_enforced_by_database()
    {
        using var client = await Client();
        var template = await Read(
            await client.PostAsJsonAsync(Url, new WorkoutTemplateInput("Scheduled", []))
        );
        using var scope = fixture.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var day = await db.WorkoutDays.SingleAsync(x => x.Id == template.Id);
        db.ScheduledWorkouts.Add(new ScheduledWorkout(day.UserId, new DateOnly(2026, 9, 22), day));
        await db.SaveChangesAsync();
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"{Url}/{template.Id}")).StatusCode
        );
        db.WorkoutDays.Add(new WorkoutDay(day.UserId, " scheduled "));
        var error = await Assert.ThrowsAsync<Topout.Application.Common.RequestException>(() =>
            db.SaveChangesAsync()
        );
        Assert.Equal(Topout.Application.Common.ErrorKind.Conflict, error.Kind);
    }
}
