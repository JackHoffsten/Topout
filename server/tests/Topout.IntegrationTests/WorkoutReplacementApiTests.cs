using System.Net;
using System.Net.Http.Json;
using Topout.Application.Exercises;
using Topout.Application.WorkoutLogging;

namespace Topout.IntegrationTests;

public partial class WorkoutLoggingApiTests
{
    [Fact]
    public async Task Replacement_persists_without_results_and_preserves_logged_values_on_repeated_replacement()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var library = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!;
        var replacement = library.First(e => e.Id != exercise.Id);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var input = new
        {
            replacementExerciseId = replacement.Id,
            order = 1,
            sets = new[]
            {
                new
                {
                    order = 1,
                    side = "Left",
                    isWarmup = true,
                },
                new
                {
                    order = 1,
                    side = "Right",
                    isWarmup = true,
                },
                new
                {
                    order = 2,
                    side = "Both",
                    isWarmup = false,
                },
            },
        };
        Assert.Equal(
            HttpStatusCode.OK,
            (
                await client.PutAsJsonAsync(url + $"/exercises/{exercise.Id}/replacement", input)
            ).StatusCode
        );
        var restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        var change = Assert.Single(restored.Log!.Replacements!);
        Assert.Equal(replacement.Id, change.Exercise.Id);
        Assert.Equal(1, change.Order);
        Assert.Equal(3, change.Sets.Count);
        Assert.Equal(exercise.Id, restored.Template!.Exercises[0].Exercise.Id);
        await client.PutAsJsonAsync(
            url + "/sets",
            new RecordSetInput(
                replacement.Id,
                1,
                9,
                42,
                true,
                "Keep",
                Topout.Domain.Enums.SetSide.Left
            ),
            ExerciseApiTests.Json
        );
        var again = input with { replacementExerciseId = exercise.Id };
        Assert.Equal(
            HttpStatusCode.OK,
            (
                await client.PutAsJsonAsync(url + $"/exercises/{replacement.Id}/replacement", again)
            ).StatusCode
        );
        restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        var result = Assert.Single(Assert.Single(restored.Log!.Exercises).Sets);
        Assert.Equal(9, result.Reps);
        Assert.Equal(42, result.WeightKg);
        Assert.True(result.IsWarmup);
        Assert.Equal("Keep", result.Notes);
        Assert.Equal(Topout.Domain.Enums.SetSide.Left, result.Side);
        Assert.Equal(exercise.Id, Assert.Single(restored.Log.Replacements!).Exercise.Id);
    }

    [Fact]
    public async Task Replacement_rejects_duplicates_other_accounts_and_stale_sources_without_changing_the_workout()
    {
        using var client = await Client();
        using var other = await Client();
        var (plan, template, exercise) = await Plan(client);
        var library = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!;
        var second = library.First(e => e.Id != exercise.Id);
        var third = library.First(e => e.Id != exercise.Id && e.Id != second.Id);
        await client.PutAsJsonAsync(
            $"/api/workout-templates/{template.Id}",
            new Topout.Application.WorkoutTemplates.WorkoutTemplateInput(
                "Pull",
                [
                    new(exercise.Id, [new(8, 12, 40, false, false)]),
                    new(second.Id, [new(10, 10, 20, false, false)]),
                ]
            )
        );
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var endpoint = url + $"/exercises/{exercise.Id}/replacement";
        var input = new ReplaceExerciseInput(third.Id, 1, [new(1)]);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync(endpoint, input, ExerciseApiTests.Json)).StatusCode
        );
        var inaccessible = (
            await other.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )![0];
        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await client.PutAsJsonAsync(
                    endpoint,
                    input with
                    {
                        ReplacementExerciseId = inaccessible.Id,
                    },
                    ExerciseApiTests.Json
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(
                    endpoint,
                    input with
                    {
                        ReplacementExerciseId = second.Id,
                    },
                    ExerciseApiTests.Json
                )
            ).StatusCode
        );
        Assert.Null(
            (await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json))!.Log
        );
        (
            await client.PutAsJsonAsync(endpoint, input, ExerciseApiTests.Json)
        ).EnsureSuccessStatusCode();
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(
                    url + $"/exercises/{second.Id}/replacement",
                    input with
                    {
                        Order = 2,
                    },
                    ExerciseApiTests.Json
                )
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await client.PutAsJsonAsync(
                    endpoint,
                    input with
                    {
                        ReplacementExerciseId = exercise.Id,
                    },
                    ExerciseApiTests.Json
                )
            ).StatusCode
        );
        var unchanged = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(third.Id, Assert.Single(unchanged.Log!.Replacements!).Exercise.Id);
        Assert.Empty(Assert.Single(unchanged.Log.Exercises).Sets);
    }

    [Fact]
    public async Task Replacement_keeps_a_completed_single_entry_and_interoperates_with_later_logging_and_removal()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var replacement = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!.First(e => e.Id != exercise.Id);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        (
            await client.PostAsJsonAsync(url, Input(exercise.Id), ExerciseApiTests.Json)
        ).EnsureSuccessStatusCode();
        var before = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        var input = new ReplaceExerciseInput(replacement.Id, 1, [new(1), new(2)]);
        (
            await client.PutAsJsonAsync(
                url + $"/exercises/{exercise.Id}/replacement",
                input,
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        var after = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(before.Log!.CompletedAt, after.Log!.CompletedAt);
        Assert.Equal(before.Log.Notes, after.Log.Notes);
        Assert.Equal(replacement.Id, Assert.Single(after.Log.Exercises).Exercise.Id);
        Assert.Equal(before.Log.Exercises[0].Sets, after.Log.Exercises[0].Sets);
        Assert.Equal(
            HttpStatusCode.Conflict,
            (await client.DeleteAsync(url + $"/exercises/{replacement.Id}")).StatusCode
        );
        await client.DeleteAsync(url);
        (
            await client.PutAsJsonAsync(
                url + $"/exercises/{exercise.Id}/replacement",
                input,
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        (
            await client.PutAsJsonAsync(
                url + "/sets",
                new RecordSetInput(
                    replacement.Id,
                    3,
                    7,
                    15,
                    false,
                    null,
                    Topout.Domain.Enums.SetSide.Left
                ),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        after = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        var structure = Assert.Single(after.Log!.Replacements!).Sets;
        Assert.Contains(structure, s => s.Order == 3 && s.Side == Topout.Domain.Enums.SetSide.Left);
        Assert.Contains(
            structure,
            s => s.Order == 3 && s.Side == Topout.Domain.Enums.SetSide.Right
        );
        (await client.DeleteAsync(url + $"/exercises/{replacement.Id}")).EnsureSuccessStatusCode();
        after = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Empty(after.Log!.Replacements!);
        Assert.Empty(after.Log.Exercises);
        Assert.Contains(exercise.Id, after.Log.RemovedExerciseIds!);
    }

    [Fact]
    public async Task Removal_of_a_replaced_slot_keeps_a_reused_identity_in_another_slot()
    {
        using var client = await Client();
        var (plan, template, first) = await Plan(client);
        var library = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!;
        var second = library.First(e => e.Id != first.Id);
        var third = library.First(e => e.Id != first.Id && e.Id != second.Id);
        await client.PutAsJsonAsync(
            $"/api/workout-templates/{template.Id}",
            new Topout.Application.WorkoutTemplates.WorkoutTemplateInput(
                "Pull",
                [
                    new(first.Id, [new(8, 12, 40, false, false)]),
                    new(second.Id, [new(10, 10, 20, false, false)]),
                ]
            )
        );
        var url = $"/api/workout-schedule/{plan.Id}/log";
        (
            await client.PutAsJsonAsync(
                url + $"/exercises/{first.Id}/replacement",
                new ReplaceExerciseInput(third.Id, 1, [new(1)]),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        (
            await client.PutAsJsonAsync(
                url + $"/exercises/{second.Id}/replacement",
                new ReplaceExerciseInput(first.Id, 2, [new(1)]),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        (await client.DeleteAsync(url + $"/exercises/{third.Id}")).EnsureSuccessStatusCode();
        (
            await client.PutAsJsonAsync(
                url + "/sets",
                new RecordSetInput(first.Id, 1, 11, 22, false, "Still here"),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        var after = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Contains(first.Id, after.Log!.RemovedExerciseIds!);
        var remaining = Assert.Single(after.Log.Replacements!);
        Assert.Equal(first.Id, remaining.Exercise.Id);
        Assert.Equal(2, remaining.Order);
        Assert.Equal(11, Assert.Single(Assert.Single(after.Log.Exercises).Sets).Reps);
    }

    [Fact]
    public async Task Replacement_preserves_an_empty_draft_set_structure()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var replacement = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!.First(e => e.Id != exercise.Id);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var response = await client.PutAsJsonAsync(
            url + $"/exercises/{exercise.Id}/replacement",
            new ReplaceExerciseInput(replacement.Id, 1, []),
            ExerciseApiTests.Json
        );
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Empty(Assert.Single(restored.Log!.Replacements!).Sets);
        Assert.Empty(Assert.Single(restored.Log.Exercises).Sets);
    }
}
