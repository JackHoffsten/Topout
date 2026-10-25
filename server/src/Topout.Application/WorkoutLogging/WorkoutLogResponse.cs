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

public sealed record ExerciseReplacementResponse(
    int OriginalExerciseId,
    ExerciseResponse Exercise,
    int Order,
    IReadOnlyList<ReplacementSetInput> Sets
);

public sealed record WorkoutLogResponse(
    int Id,
    DateOnly Date,
    string? Notes,
    DateTime? CompletedAt,
    IReadOnlyList<LoggedExerciseResponse> Exercises,
    string? Location = null,
    IReadOnlyList<int>? RemovedExerciseIds = null,
    IReadOnlyList<ExerciseReplacementResponse>? Replacements = null,
    IReadOnlyList<int>? ExerciseOrder = null
)
{
    public static WorkoutLogResponse From(WorkoutLog log) =>
        new(
            log.Id,
            log.Date,
            log.Notes,
            log.CompletedAt,
            log.Entries.OrderBy(e =>
                    Array.IndexOf(log.ExerciseOrder, e.ExerciseId) is var index && index >= 0
                        ? index
                        : 100 + e.Order
                )
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
            log.RemovedExerciseIds,
            log.Entries.Where(e => e.OriginalExerciseId.HasValue)
                .Select(e => new ExerciseReplacementResponse(
                    e.OriginalExerciseId!.Value,
                    ExerciseResponse.From(e.Exercise),
                    e.ReplacementOrder!.Value,
                    e.ReplacementSets.Select(s => new ReplacementSetInput(
                            s.Order,
                            s.Side,
                            s.IsWarmup
                        ))
                        .ToArray()
                ))
                .ToArray(),
            log.ExerciseOrder
        );
}
