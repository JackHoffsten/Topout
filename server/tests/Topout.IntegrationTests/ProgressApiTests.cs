using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Topout.Application.Climbing;
using Topout.Application.Exercises;
using Topout.Application.Progress;
using Topout.Application.WorkoutLogging;
using Topout.Application.WorkoutSchedule;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Enums;

namespace Topout.IntegrationTests;

[Collection("api")]
public class ProgressApiTests(ApiFixture fixture)
{
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

    [Fact]
    public async Task Progress_is_authenticated_and_user_scoped_and_validates_dates()
    {
        using var anonymous = fixture.Client();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/progress")).StatusCode
        );
        using var client = await Client();
        using var other = await Client();
        var climb = new ClimbLogInput(
            new(2026, 10, 1),
            "Bouldering",
            "Font",
            "7A",
            "Indoor",
            1,
            "Flash",
            null,
            [],
            null,
            null
        );
        Assert.Equal(
            HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/climb-logs", climb)).StatusCode
        );
        var located = await client.PostAsJsonAsync(
            "/api/climb-logs",
            climb with
            {
                Location = "Central Gym",
            }
        );
        located.EnsureSuccessStatusCode();
        var filtered = (
            await client.GetFromJsonAsync<ProgressResponse>("/api/progress?location=central%20gym")
        )!;
        Assert.Equal(1, Assert.Single(filtered.Climbing).Climbs);
        Assert.Empty(
            (
                await other.GetFromJsonAsync<ProgressResponse>(
                    "/api/progress?location=Central%20Gym"
                )
            )!.Climbing
        );
        Assert.Empty(
            (
                await client.GetFromJsonAsync<ProgressResponse>("/api/progress?location=Missing")
            )!.Climbing
        );
        Assert.Single(
            (
                await client.GetFromJsonAsync<ProgressResponse>(
                    "/api/progress?location=Missing&location=Central%20Gym"
                )
            )!.Climbing
        );
        await client.DeleteAsync(
            $"/api/climb-logs/{(await located.Content.ReadFromJsonAsync<ClimbLogResponse>())!.Id}"
        );
        var own = (await client.GetFromJsonAsync<ProgressResponse>("/api/progress"))!;
        Assert.Equal(1, Assert.Single(own.Climbing).Flashes);
        var isolated = (await other.GetFromJsonAsync<ProgressResponse>("/api/progress"))!;
        Assert.Empty(isolated.Climbing);
        Assert.Empty(isolated.Exercises);
        Assert.Empty(
            (
                await client.GetFromJsonAsync<ProgressResponse>("/api/progress?from=2026-10-02")
            )!.Climbing
        );
        foreach (
            var range in new[]
            {
                "?from=2026-10-03&to=2026-10-01",
                "?from=invalid",
                "?to=0001-01-01",
            }
        )
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await client.GetAsync("/api/progress" + range)).StatusCode
            );
    }

    [Fact]
    public async Task Progress_aggregates_working_sets_and_climbs_and_reflects_edits_and_deletes()
    {
        using var client = await Client();
        var exercise = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )![0];
        var template = (
            await (
                await client.PostAsJsonAsync(
                    "/api/workout-templates",
                    new WorkoutTemplateInput("Progress", [new(exercise.Id, [])])
                )
            ).Content.ReadFromJsonAsync<WorkoutTemplateResponse>(ExerciseApiTests.Json)
        )!;
        var plan = (
            await (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(new(2026, 10, 1), template.Id)
                )
            ).Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
        )!;
        var url = $"/api/workout-schedule/{plan.Id}/log";
        foreach (
            var input in new[]
            {
                new RecordSetInput(exercise.Id, 1, 8, 12, false, null, SetSide.Left),
                new RecordSetInput(exercise.Id, 1, 10, 14, false, null, SetSide.Right),
                new RecordSetInput(exercise.Id, 2, 6, 10, false, null, SetSide.Left),
                new RecordSetInput(exercise.Id, 3, 20, 100, true, null),
            }
        )
            Assert.Equal(
                HttpStatusCode.OK,
                (
                    await client.PutAsJsonAsync(url + "/sets", input, ExerciseApiTests.Json)
                ).StatusCode
            );
        var climb = new ClimbLogInput(
            new(2026, 10, 1),
            "Bouldering",
            "Font",
            "7A",
            "Indoor",
            1,
            "Flash",
            null,
            [],
            null,
            null
        );
        var saved = (
            await (
                await client.PostAsJsonAsync("/api/climb-logs", climb)
            ).Content.ReadFromJsonAsync<ClimbLogResponse>()
        )!;
        await client.PostAsJsonAsync(
            "/api/climb-logs",
            climb with
            {
                Outcome = "Attempted",
                Attempts = 3,
            }
        );
        var data = (
            await client.GetFromJsonAsync<ProgressResponse>(
                "/api/progress?from=2026-10-01&to=2026-10-01"
            )
        )!;
        Assert.Equal(2, data.Exercises.Count);
        var left = data.Exercises.Single(x => x.Side == "Left");
        Assert.Equal(2, left.Sets);
        Assert.Equal(14, left.Reps);
        Assert.Equal(12, left.MaxWeightKg);
        Assert.Equal(156, left.VolumeKg);
        Assert.Equal(140, data.Exercises.Single(x => x.Side == "Right").VolumeKg);
        var climbed = Assert.Single(data.Climbing);
        Assert.Equal(2, climbed.Climbs);
        Assert.Equal(1, climbed.Sends);
        Assert.Equal(1, climbed.Flashes);
        Assert.Equal(4, climbed.Attempts);
        (
            await client.PutAsJsonAsync(url + "/location", new { location = "Central Gym" })
        ).EnsureSuccessStatusCode();
        Assert.Equal(
            2,
            (
                await client.GetFromJsonAsync<ProgressResponse>(
                    "/api/progress?location=central%20gym"
                )
            )!
                .Exercises
                .Count
        );
        Assert.Empty(
            (
                await client.GetFromJsonAsync<ProgressResponse>("/api/progress?location=Missing")
            )!.Exercises
        );
        await client.PutAsJsonAsync(
            url + "/sets",
            new RecordSetInput(exercise.Id, 1, 9, 15, false, null, SetSide.Left),
            ExerciseApiTests.Json
        );
        await client.DeleteAsync($"/api/climb-logs/{saved.Id}");
        data = (await client.GetFromJsonAsync<ProgressResponse>("/api/progress"))!;
        Assert.Equal(15, data.Exercises.Single(x => x.Side == "Left").MaxWeightKg);
        Assert.Equal(0, Assert.Single(data.Climbing).Sends);
        await client.DeleteAsync(url);
        Assert.Empty((await client.GetFromJsonAsync<ProgressResponse>("/api/progress"))!.Exercises);
    }
}
