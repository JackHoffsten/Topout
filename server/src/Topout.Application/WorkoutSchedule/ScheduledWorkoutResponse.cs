using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Domain.Entities;

namespace Topout.Application.WorkoutSchedule;

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
