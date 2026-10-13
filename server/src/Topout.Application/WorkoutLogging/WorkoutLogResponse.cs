using Topout.Application.Abstractions;
using Topout.Application.Common;
using Topout.Application.Exercises;
using Topout.Application.WorkoutTemplates;
using Topout.Domain.Entities;
using Topout.Domain.Enums;
using Topout.Domain.ValueObjects;

namespace Topout.Application.WorkoutLogging;

public sealed record LoggedSetResponse(
    int Reps,
    decimal WeightKg,
    bool IsWarmup,
    string? Notes,
    int Order,
    SetSide Side = SetSide.Both
);

public sealed record LoggedExerciseResponse(
    ExerciseResponse Exercise,
    IReadOnlyList<LoggedSetResponse> Sets
);

public sealed record WorkoutLogResponse(
    int Id,
    DateOnly Date,
    string? Notes,
    DateTime? CompletedAt,
    IReadOnlyList<LoggedExerciseResponse> Exercises,
    string? Location = null,
    IReadOnlyList<int>? RemovedExerciseIds = null
)
{
    public static WorkoutLogResponse From(WorkoutLog log) =>
        new(
            log.Id,
            log.Date,
            log.Notes,
            log.CompletedAt,
            log.Entries.OrderBy(e => e.Order)
                .Select(e => new LoggedExerciseResponse(
                    ExerciseResponse.From(e.Exercise),
                    e.Sets.OrderBy(s => s.Order)
                        .ThenBy(s => s.Side)
                        .Select(s => new LoggedSetResponse(
                            s.Reps,
                            s.Weight.Kilograms,
                            s.IsWarmup,
                            s.Notes,
                            s.Order,
                            s.Side
                        ))
                        .ToArray()
                ))
                .ToArray(),
            log.Location,
            log.RemovedExerciseIds
        );
}
