using System.Net.Http.Json;
using Topout.Application.WorkoutLogging;
using Topout.Application.WorkoutSchedule;
using Topout.Domain.Enums;

namespace Topout.IntegrationTests;

public partial class WorkoutLoggingApiTests
{
    [Theory]
    [InlineData(" central GYM ", 8)]
    [InlineData("Unknown", 12)]
    [InlineData("", 12)]
    public async Task History_prefers_location_per_set_and_side_and_refreshes_when_location_is_saved(
        string location,
        int expectedReps
    )
    {
        using var client = await Client();
        var (old, _, exercise) = await Plan(client);
        async Task<ScheduledWorkoutResponse> Schedule(int days) =>
            (
                await (
                    await client.PostAsJsonAsync(
                        "/api/workout-schedule",
                        new ScheduleWorkoutInput(old.Date.AddDays(days), old.TemplateId)
                    )
                ).Content.ReadFromJsonAsync<ScheduledWorkoutResponse>(ExerciseApiTests.Json)
            )!;
        async Task Record(int id, int order, int reps, SetSide side, string at) =>
            (
                await client.PutAsJsonAsync(
                    $"/api/workout-schedule/{id}/log/sets",
                    new RecordSetInput(exercise.Id, order, reps, 40, false, null, side, at),
                    ExerciseApiTests.Json
                )
            ).EnsureSuccessStatusCode();

        var newer = await Schedule(1);
        var current = await Schedule(2);
        var future = await Schedule(3);
        await Record(old.Id, 1, 8, SetSide.Left, "Central Gym");
        await Record(newer.Id, 1, 12, SetSide.Left, "Other Gym");
        await Record(newer.Id, 1, 13, SetSide.Right, "Other Gym");
        await Record(newer.Id, 2, 14, SetSide.Both, "Other Gym");
        await Record(future.Id, 1, 99, SetSide.Left, "Central Gym");
        await Record(current.Id, 1, 98, SetSide.Left, "Other Gym");
        var url = $"/api/workout-schedule/{current.Id}/log";
        var response = await client.PutAsJsonAsync(url + "/location", new { location });
        response.EnsureSuccessStatusCode();
        var history = (
            await response.Content.ReadFromJsonAsync<WorkoutLoggingResponse>(ExerciseApiTests.Json)
        )!.PreviousSets!;
        var left = history.Single(s => s.Order == 1 && s.Side == SetSide.Left);
        Assert.Equal(expectedReps, left.Reps);
        Assert.Equal(expectedReps == 8 ? old.Date : newer.Date, left.Date);
        Assert.Equal(13, history.Single(s => s.Side == SetSide.Right).Reps);
        Assert.Equal(14, history.Single(s => s.Order == 2).Reps);
        Assert.Equal(3, history.Count);

        var cleared = await client.PutAsJsonAsync(
            url + "/location",
            new { location = (string?)null }
        );
        cleared.EnsureSuccessStatusCode();
        Assert.Equal(
            12,
            (
                await cleared.Content.ReadFromJsonAsync<WorkoutLoggingResponse>(
                    ExerciseApiTests.Json
                )
            )!
                .PreviousSets!.Single(s => s.Order == 1 && s.Side == SetSide.Left)
                .Reps
        );
    }
}
