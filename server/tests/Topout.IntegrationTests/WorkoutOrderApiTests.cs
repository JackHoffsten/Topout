using System.Net;
using System.Net.Http.Json;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Application.WorkoutLogging;
using Topout.Application.WorkoutTemplates;

namespace Topout.IntegrationTests;

public partial class WorkoutLoggingApiTests
{
    [Fact]
    public async Task Order_restores_empty_exercises_and_survives_recording_replacement_removal_and_completion()
    {
        using var client = await Client();
        using var other = await Client();
        var (plan, _, exercise) = await Plan(client);
        var extras = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!
            .Where(e => e.Id != exercise.Id)
            .Take(2)
            .ToArray();
        var url = $"/api/workout-schedule/{plan.Id}/log";
        var endpoint = url + "/exercises/order";
        var order = new ExerciseOrderInput([extras[0].Id, exercise.Id]);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync(endpoint, order)).StatusCode
        );
        (await client.PutAsJsonAsync(endpoint, order)).EnsureSuccessStatusCode();
        var restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(order.ExerciseIds, restored.Log!.ExerciseOrder);
        Assert.Equal(order.ExerciseIds, restored.Log.Exercises.Select(e => e.Exercise.Id));
        Assert.All(restored.Log.Exercises, e => Assert.Empty(e.Sets));
        Assert.Single(restored.Template!.Exercises);
        Assert.Equal(exercise.Id, restored.Template.Exercises[0].Exercise.Id);
        (
            await client.PutAsJsonAsync(
                url + "/sets",
                new RecordSetInput(exercise.Id, 1, 8, 42, true, "Keep")
            )
        ).EnsureSuccessStatusCode();
        (await client.DeleteAsync(url + $"/sets/{exercise.Id}/1")).EnsureSuccessStatusCode();
        restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(order.ExerciseIds, restored.Log!.Exercises.Select(e => e.Exercise.Id));
        (
            await client.PutAsJsonAsync(
                url + "/sets",
                new RecordSetInput(exercise.Id, 1, 8, 42, true, "Keep")
            )
        ).EnsureSuccessStatusCode();
        (
            await client.PutAsJsonAsync(
                url + $"/exercises/{exercise.Id}/replacement",
                new ReplaceExerciseInput(extras[1].Id, 2, [new(1)]),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(new[] { extras[0].Id, extras[1].Id }, restored.Log!.ExerciseOrder);
        Assert.Equal("Keep", restored.Log.Exercises[1].Sets[0].Notes);
        (await client.DeleteAsync(url + $"/exercises/{extras[0].Id}")).EnsureSuccessStatusCode();
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(
                    endpoint,
                    new ExerciseOrderInput([extras[0].Id, extras[1].Id])
                )
            ).StatusCode
        );
        (
            await client.PostAsJsonAsync(
                url,
                new CompleteWorkoutInput("Done", [new(extras[1].Id, [new(8, 42, true, "Keep")])])
            )
        ).EnsureSuccessStatusCode();
        restored = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(new[] { extras[1].Id }, restored.Log!.ExerciseOrder);
        Assert.NotNull(restored.Log.CompletedAt);
    }

    [Fact]
    public async Task Completed_reorder_preserves_results_and_time_and_rejects_invalid_or_incomplete_sequences()
    {
        using var client = await Client();
        var (plan, _, exercise) = await Plan(client);
        var second = (
            await client.GetFromJsonAsync<ExerciseResponse[]>(
                "/api/exercises",
                ExerciseApiTests.Json
            )
        )!.First(e => e.Id != exercise.Id);
        var url = $"/api/workout-schedule/{plan.Id}/log";
        (
            await client.PostAsJsonAsync(
                url,
                new CompleteWorkoutInput(
                    "Keep",
                    [
                        new(
                            exercise.Id,
                            [
                                new(8, 20, true, "Left", Topout.Domain.Enums.SetSide.Left, 1),
                                new(10, 30, false, "Right", Topout.Domain.Enums.SetSide.Right, 1),
                            ]
                        ),
                        new(second.Id, [new(12, 40, false, null)]),
                    ]
                ),
                ExerciseApiTests.Json
            )
        ).EnsureSuccessStatusCode();
        var before = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        var endpoint = url + "/exercises/order";
        foreach (
            var invalid in new[]
            {
                Array.Empty<int>(),
                new[] { exercise.Id, exercise.Id },
                Enumerable.Range(1, 101).ToArray(),
                new[] { -1 },
            }
        )
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await client.PutAsJsonAsync(endpoint, new ExerciseOrderInput(invalid))).StatusCode
            );
        Assert.Equal(
            HttpStatusCode.Conflict,
            (
                await client.PutAsJsonAsync(endpoint, new ExerciseOrderInput([exercise.Id]))
            ).StatusCode
        );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await client.PutAsJsonAsync(
                    endpoint,
                    new ExerciseOrderInput([exercise.Id, int.MaxValue])
                )
            ).StatusCode
        );
        (
            await client.PutAsJsonAsync(endpoint, new ExerciseOrderInput([second.Id, exercise.Id]))
        ).EnsureSuccessStatusCode();
        var after = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(before.Log!.CompletedAt, after.Log!.CompletedAt);
        Assert.Equal("Keep", after.Log.Notes);
        Assert.Equal(
            new[] { second.Id, exercise.Id },
            after.Log.Exercises.Select(e => e.Exercise.Id)
        );
        Assert.Equal(before.Log.Exercises[0].Sets, after.Log.Exercises[1].Sets);
        Assert.Equal(before.Log.Exercises[1].Sets, after.Log.Exercises[0].Sets);
        // Changing the source template's order must not rewrite the persisted session sequence.
        (
            await client.PutAsJsonAsync(
                $"/api/workout-templates/{before.Template!.Id}/exercises/order",
                new ExerciseOrderInput([exercise.Id, second.Id])
            )
        ).EnsureSuccessStatusCode();
        var unchanged = (
            await client.GetFromJsonAsync<WorkoutLoggingResponse>(url, ExerciseApiTests.Json)
        )!;
        Assert.Equal(
            new[] { exercise.Id, second.Id },
            unchanged.Template!.Exercises.Select(e => e.Exercise.Id)
        );
        Assert.Equal(
            new[] { second.Id, exercise.Id },
            unchanged.Log!.Exercises.Select(e => e.Exercise.Id)
        );
        Assert.Equal(after.Log.Exercises[1].Sets, unchanged.Log.Exercises[1].Sets);
    }
}

public partial class WorkoutTemplateApiTests
{
    [Fact]
    public async Task Template_order_saves_only_membership_and_order_preserving_targets_and_name()
    {
        using var client = await Client();
        using var other = await Client();
        var exercises = (await Exercises(client)).Take(3).ToArray();
        var split = Set with { RightTarget = new(10, 14, 30) };
        var template = await Read(
            await client.PostAsJsonAsync(
                Url,
                new WorkoutTemplateInput(
                    "Order",
                    [new(exercises[0].Id, [split]), new(exercises[1].Id, [])]
                )
            )
        );
        var path = $"{Url}/{template.Id}";
        var endpoint = path + "/exercises/order";
        var order = new ExerciseOrderInput([exercises[2].Id, exercises[1].Id, exercises[0].Id]);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await other.PutAsJsonAsync(endpoint, order)).StatusCode
        );
        (await client.PutAsJsonAsync(endpoint, order)).EnsureSuccessStatusCode();
        var saved = await Read(await client.GetAsync(path));
        Assert.Equal(order.ExerciseIds, saved.Exercises.Select(e => e.Exercise.Id));
        Assert.Equal("Order", saved.Name);
        Assert.Empty(saved.Exercises[0].Sets);
        Assert.Empty(saved.Exercises[1].Sets);
        Assert.Equal(split, Assert.Single(saved.Exercises[2].Sets));
        foreach (
            var ids in new[]
            {
                new[] { exercises[0].Id, exercises[0].Id },
                Array.Empty<int>(),
                Enumerable.Range(1, 101).ToArray(),
            }
        )
            Assert.Equal(
                HttpStatusCode.BadRequest,
                (await client.PutAsJsonAsync(endpoint, new ExerciseOrderInput(ids))).StatusCode
            );
        Assert.Equal(
            HttpStatusCode.NotFound,
            (
                await client.PutAsJsonAsync(endpoint, new ExerciseOrderInput([int.MaxValue]))
            ).StatusCode
        );
        saved = await Read(await client.GetAsync(path));
        Assert.Equal(order.ExerciseIds, saved.Exercises.Select(e => e.Exercise.Id));
        // Omitting a draft-removed exercise cannot silently commit that removal.
        (
            await client.PutAsJsonAsync(
                endpoint,
                new ExerciseOrderInput([exercises[0].Id, exercises[2].Id])
            )
        ).EnsureSuccessStatusCode();
        saved = await Read(await client.GetAsync(path));
        Assert.Equal(
            new[] { exercises[0].Id, exercises[2].Id, exercises[1].Id },
            saved.Exercises.Select(e => e.Exercise.Id)
        );
        Assert.Equal(split, saved.Exercises[0].Sets[0]);
    }
}
