using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Topout.Application.Exercises;
using Topout.Application.WorkoutLogging;
using Topout.Application.WorkoutSchedule;
using Topout.Application.WorkoutTemplates;
using Topout.Infrastructure.Persistence;

namespace Topout.IntegrationTests;

[Collection("api")]
public class WorkoutLoggingApiTests(ApiFixture fixture)
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

    private static async Task<(
        ScheduledWorkoutResponse Plan,
        WorkoutTemplateResponse Template,
        ExerciseResponse Exercise
    )> Plan(HttpClient client)
    {
        var exercises = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!;
        var input = new WorkoutTemplateInput(
            "Pull",
            [new(exercises[0].Id, [new(8, 12, 40, true, false)])]
        );
        var template = (
            await (
                await client.PostAsJsonAsync("/api/workout-templates", input)
            ).Content.ReadFromJsonAsync<WorkoutTemplateResponse>(ExerciseApiTests.Json)
        )!;
        var plan = (
            await (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(new DateOnly(2026, 10, 1), template.Id)
                )
            ).Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
        )!;
        return (plan, template, exercises[0]);
    }

    private static CompleteWorkoutInput Input(int exerciseId) =>
        new(
            "Training notes",
            [new(exerciseId, [new(9, 45.5m, true, "Set notes"), new(7, 50, false, null)])]
        );

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Logs_protect_plans_and_can_be_deleted_without_removing_the_plan(
        bool completed
    )
    {
        using var client = await Client();
        using var other = await Client();
        var (plan, _, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var recorded = completed
            ? await client.PostAsJsonAsync(url, Input(exercise.Id))
            : await client.PutAsJsonAsync(
                url + "/sets",
                new RecordSetInput(exercise.Id, 1, 8, 40, false, null)
            );
        Assert.Equal(HttpStatusCode.OK, recorded.StatusCode);
        var logId = (
            await recorded.Content.ReadFromJsonAsync<WorkoutLoggingResponse>(ExerciseApiTests.Json)
        )!
            .Log!
            .Id;
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/workout-schedule/{plan.Id}")).StatusCode
        );
        Assert.Equal(HttpStatusCode.NotFound, (await other.DeleteAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(url)).StatusCode);
        using (var scope = fixture.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False(await db.WorkoutLogs.AnyAsync(x => x.Id == logId));
            Assert.False(await db.WorkoutLogEntries.AnyAsync(x => x.WorkoutLogId == logId));
        }
        var restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Null(restored.Log);
        var plans = (
            await client.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                "/api/workout-schedule?from=2026-10-01&to=2026-10-01",
                ExerciseApiTests.Json
            )
        )!;
        Assert.Equal("Planned", Assert.Single(plans).Status);
        Assert.Equal(plan.TemplateId, plans[0].TemplateId);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/workout-schedule/{plan.Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Logging_preserves_actual_sets_and_marks_calendar_completed_atomically()
    {
        using var client = await Client();
        var (plan, template, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var before = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Null(before.Log);
        Assert.Equal(8, before.Template!.Exercises[0].Sets[0].TargetRepsMin);
        var saved = await client.PostAsJsonAsync(url, Input(exercise.Id));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var log = (
            await saved.Content.ReadFromJsonAsync<WorkoutLoggingResponse>(ExerciseApiTests.Json)
        )!.Log!;
        Assert.Equal(plan.Date, log.Date);
        Assert.NotNull(log.CompletedAt);
        Assert.Equal("Training notes", log.Notes);
        Assert.Equal(
            Input(exercise.Id).Exercises[0].Sets,
            log.Exercises[0]
                .Sets.Select(s => new LoggedSetInput(s.Reps, s.WeightKg, s.IsWarmup, s.Notes))
        );
        var calendar = (
            await client.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                "/api/workout-schedule?from=2026-10-01&to=2026-10-31",
                ExerciseApiTests.Json
            )
        )!;
        Assert.Equal("Completed", Assert.Single(calendar).Status);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/workout-schedule/{plan.Id}")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync(url, Input(exercise.Id))).StatusCode
        );
        await client.PutAsJsonAsync(
            $"/api/workout-templates/{template.Id}",
            new WorkoutTemplateInput("Changed", [])
        );
        var reloaded = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(45.5m, reloaded.Log!.Exercises[0].Sets[0].WeightKg);
        Assert.Equal(9, reloaded.Log.Exercises[0].Sets[0].Reps);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/exercises/{exercise.Id}")).StatusCode
        );
    }

    [Fact]
    public async Task Invalid_logging_leaves_plan_unchanged_and_rejects_other_users_and_rest_days()
    {
        using var client = await Client();
        using var other = await Client();
        var (plan, _, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync(url)).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PostAsJsonAsync(url, Input(exercise.Id))).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync(url, new CompleteWorkoutInput(null, []))).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (
                await client.PostAsJsonAsync(
                    url,
                    new CompleteWorkoutInput(null, [new(exercise.Id, [new(0, 20, false, null)])])
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (
                await client.PostAsJsonAsync(
                    url,
                    new CompleteWorkoutInput(new string('x', 2001), Input(exercise.Id).Exercises)
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PostAsJsonAsync(
                    url,
                    new CompleteWorkoutInput(
                        null,
                        [Input(exercise.Id).Exercises[0], Input(exercise.Id).Exercises[0]]
                    )
                )
            ).StatusCode
        );
        var otherExercise = (
            await other.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )![0];
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync(url, Input(otherExercise.Id))).StatusCode
        );
        Assert.Null(
            (await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json))!.Log
        );
        var rest = (
            await (
                await client.PostAsJsonAsync(
                    "/api/workout-schedule",
                    new ScheduleWorkoutInput(plan.Date.AddDays(1), null)
                )
            ).Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
        )!;
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PostAsJsonAsync(
                    $"/api/workout-schedule/{rest.Id}/log",
                    Input(exercise.Id)
                )
            ).StatusCode
        );
        using var anonymous = fixture.Client();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Concurrent_completion_saves_only_one_log()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var results = await Task.WhenAll(
            client.PostAsJsonAsync(url, Input(exercise.Id)),
            client.PostAsJsonAsync(url, Input(exercise.Id))
        );
        Assert.Single(results, response => response.StatusCode == HttpStatusCode.OK);
        Assert.Single(results, response => response.StatusCode == HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Individual_sets_resume_and_completed_workouts_can_be_edited_without_changing_completion_time()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var input = new RecordSetInput(exercise.Id, 2, 9, 45, true, "Saved individually");
        var saved = await client.PutAsJsonAsync(url + "/sets", input);
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        var progress = (
            await saved.Content.ReadFromJsonAsync<WorkoutLoggingResponse>(ExerciseApiTests.Json)
        )!;
        Assert.Null(progress.Log!.CompletedAt);
        var logId = progress.Log.Id;
        Assert.Equal(2, Assert.Single(progress.Log.Exercises[0].Sets).Order);
        var resumed = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(9, resumed.Log!.Exercises[0].Sets[0].Reps);
        Assert.Equal(
            "InProgress",
            Assert
                .Single(
                    (
                        await client.GetFromJsonAsync<ScheduledWorkoutResponse[]>(
                            "/api/workout-schedule?from=2026-10-01&to=2026-10-31",
                            ExerciseApiTests.Json
                        )
                    )!
                )
                .Status
        );
        await client.PutAsJsonAsync(url + "/sets", input with { Reps = 10 });
        resumed = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Single(resumed.Log!.Exercises[0].Sets);
        Assert.Equal(10, resumed.Log.Exercises[0].Sets[0].Reps);
        await client.PutAsJsonAsync(url + "/sets", input with { Order = 1 });
        Assert.Equal(
            HttpStatusCode.OK,
            (await client.DeleteAsync(url + $"/sets/{exercise.Id}/2")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.OK,
            (await client.PostAsJsonAsync(url, Input(exercise.Id))).StatusCode
        );
        var completed = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(logId, completed.Log!.Id);
        var completedAt = completed.Log.CompletedAt;
        Assert.NotNull(completedAt);
        var edit = new CompleteWorkoutInput(
            "Corrected",
            [new(exercise.Id, [new(11, 48, false, "Correction")])]
        );
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(url, edit)).StatusCode);
        var corrected = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!.Log!;
        Assert.Equal(logId, corrected.Id);
        Assert.Equal(completedAt, corrected.CompletedAt);
        Assert.Equal(11, corrected.Exercises[0].Sets[0].Reps);
        Assert.Equal("Corrected", corrected.Notes);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync(url + $"/sets/{exercise.Id}/1")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync(url, new CompleteWorkoutInput(null, []))).StatusCode
        );
        Assert.Equal(
            11,
            (await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json))!
                .Log!
                .Exercises[0]
                .Sets[0]
                .Reps
        );
    }

    [Fact]
    public async Task Set_mutations_and_completed_edits_are_owned_and_validate_input()
    {
        using var client = await Client();
        using var other = await Client();
        var (plan, _, exercise) = await Plan(client);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var input = new RecordSetInput(exercise.Id, 1, 8, 40, false, null);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync(url + "/sets", input)).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync(url, Input(exercise.Id))).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.DeleteAsync(url + $"/sets/{exercise.Id}/1")).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync(url + "/sets", input with { Reps = 0 })).StatusCode
        );
        Assert.Null(
            (await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json))!.Log
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync(url, Input(exercise.Id))).StatusCode
        );
    }
}
