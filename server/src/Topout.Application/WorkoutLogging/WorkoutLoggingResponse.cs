using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutLogging;

public sealed record WorkoutLoggingResponse(
    int ScheduleId,
    DateOnly Date,
    string? TemplateName,
    WorkoutTemplateResponse? Template,
    WorkoutLogResponse? Log,
    IReadOnlyList<PreviousSetResponse>? PreviousSets = null
)
{
    public static WorkoutLoggingResponse From(ScheduledWorkout schedule) =>
        new(
            schedule.Id,
            schedule.Date,
            schedule.WorkoutDay?.Name,
            schedule.WorkoutDay is null ? null : WorkoutTemplateResponse.From(schedule.WorkoutDay),
            schedule.WorkoutLog is null ? null : WorkoutLogResponse.From(schedule.WorkoutLog)
        );
}

public sealed record PreviousSetResponse(
    int ExerciseId,
    int Order,
    DateOnly Date,
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    SetSide Side = SetSide.Both,
    string? Notes = null,
    string? Location = null
);
