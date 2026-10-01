using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Topout.Application.WorkoutSchedule;
using Topout.Application.WorkoutTemplates;

namespace Topout.IntegrationTests;

[Collection("api")]
public class WorkoutScheduleApiTests(ApiFixture fixture)
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
    public async Task Schedule_persists_multiple_workouts_and_rest_days_and_protects_templates()
    {
        using var client = await Client();
        var response = await client.PostAsJsonAsync(
            "/api/workout-templates",
            new WorkoutTemplateInput("Push", [])
        );
        var template = (
            await response.Content.ReadFromJsonAsync<WorkoutTemplateResponse>(ExerciseApiTests.Json)
        )!;
        var date = new DateOnly(2026, 10, 2);
        var created = await client.PostAsJsonAsync(
            "/api/workout-schedule",
            new ScheduleWorkoutInput(date, template.Id)
        );
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var plan = (
            await created.Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
        )!;
        Assert.Equal(template.Id, plan.TemplateId);
        Assert.Equal("Push", plan.TemplateName);
        Assert.Equal("Planned", plan.Status);
        Assert.False(plan.IsRestDay);
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date, template.Id)
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Created,
            (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(date.AddDays(1), null)
                )
            ).StatusCode
        );
        var plans = (
            await client.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                "/api/workout-schedule?from=2026-10-01&to=2026-10-31",
                ExerciseApiTests.Json
            )
        )!;
        Assert.Equal(3, plans.Length);
        Assert.True(plans[2].IsRestDay);
        Assert.Null(plans[2].TemplateId);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/workout-templates/{template.Id}")).StatusCode
        );
        foreach (var item in plans)
            Assert.Equal(
                HttpStatusCode.NoContent,
                (await client.DeleteAsync($"/api/workout-schedule/{item.Id}")).StatusCode
            );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.DeleteAsync($"/api/workout-schedule/{plan.Id}")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/workout-templates/{template.Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Schedule_is_user_scoped_and_rejects_invalid_dates_and_ranges()
    {
        using var owner = await Client();
        using var other = await Client();
        var response = await owner.PostAsJsonAsync(
            "/api/workout-templates",
            new WorkoutTemplateInput("Private", [])
        );
        var template = (
            await response.Content.ReadFromJsonAsync<WorkoutTemplateResponse>(ExerciseApiTests.Json)
        )!;
        var input = new ScheduleWorkoutInput(new DateOnly(2026, 10, 2), template.Id);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PostAsJsonAsync("/api/workout-schedule", input)).StatusCode
        );
        var created = await owner.PostAsJsonAsync("/api/workout-schedule", input);
        var plan = (
            await created.Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
        )!;
        Assert.Empty(
            (
                await other.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                    "/api/workout-schedule?from=2026-10-01&to=2026-10-31",
                    ExerciseApiTests.Json
                )
            )!
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.DeleteAsync($"/api/workout-schedule/{plan.Id}")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (
                await owner.PostAsJsonAsync("/api/workout-schedule", input with { Date = default })
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await owner.GetAsync("/api/workout-schedule?from=2026-10-31&to=2026-10-01")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await owner.GetAsync("/api/workout-schedule?from=2026-01-01&to=2026-12-31")).StatusCode
        );
        using var anonymous = fixture.Client();
        Assert.Equal(
            HttpStatusCode.Unauthorized,
            (
                await anonymous.GetAsync("/api/workout-schedule?from=2026-10-01&to=2026-10-31")
            ).StatusCode
        );
    }
}
