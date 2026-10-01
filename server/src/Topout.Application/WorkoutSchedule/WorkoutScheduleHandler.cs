using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.WorkoutSchedule;

public sealed record ScheduleWorkoutInput(DateOnly Date, int? TemplateId);

public sealed record ScheduledWorkoutResponse(
    int Id,
    DateOnly Date,
    int? TemplateId,
    string? TemplateName,
    bool IsRestDay,
    string Status
)
{
    public static ScheduledWorkoutResponse From(ScheduledWorkout workout) =>
        new(
            workout.Id,
            workout.Date,
            workout.WorkoutDayId,
            workout.WorkoutDay?.Name,
            workout.IsRestDay,
            workout.Status == Topout.Domain.Enums.ScheduledStatus.Planned
            && workout.WorkoutLogId.HasValue
                ? "InProgress"
                : workout.Status.ToString()
        );
}

public sealed class WorkoutScheduleHandler(IWorkoutScheduleRepository schedule, ICurrentUser user)
{
    public async Task<IReadOnlyList<ScheduledWorkoutResponse>> ListAsync(
        DateOnly from,
        DateOnly to,
        CancellationToken ct
    )
    {
        if (from == default || to == default || to < from || to.DayNumber - from.DayNumber > 62)
            throw new RequestException(
                ErrorKind.Validation,
                "Choose a date range of at most 63 days."
            );
        return (await schedule.ListAsync(user.UserId, from, to, ct))
            .Select(ScheduledWorkoutResponse.From)
            .ToArray();
    }

    public async Task<ScheduledWorkoutResponse> CreateAsync(
        ScheduleWorkoutInput input,
        CancellationToken ct
    )
    {
        if (input.Date == default || input.TemplateId is <= 0)
            throw new RequestException(ErrorKind.Validation, "Choose a valid date and template.");
        return ScheduledWorkoutResponse.From(
            await schedule.CreateAsync(user.UserId, input.Date, input.TemplateId, ct)
        );
    }

    public Task DeleteAsync(int id, CancellationToken ct) =>
        schedule.DeleteAsync(user.UserId, id, ct);
}
