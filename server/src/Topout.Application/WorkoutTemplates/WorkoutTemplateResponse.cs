using Topout.Application.Exercises;
using Topout.Domain.Entities;

namespace Topout.Application.WorkoutTemplates;

public sealed record PlannedSetInput(
    int TargetRepsMin,
    int? TargetRepsMax,
    decimal? TargetWeightKg,
    bool IsWarmup,
    bool IsAmrap
);

public sealed record TemplateExerciseInput(int ExerciseId, IReadOnlyList<PlannedSetInput> Sets);

public sealed record WorkoutTemplateInput(
    string Name,
    IReadOnlyList<TemplateExerciseInput> Exercises
);

public sealed record TemplateExerciseResponse(
    ExerciseResponse Exercise,
    IReadOnlyList<PlannedSetInput> Sets
);

public sealed record WorkoutTemplateResponse(
    int Id,
    string Name,
    IReadOnlyList<TemplateExerciseResponse> Exercises
)
{
    public static WorkoutTemplateResponse From(WorkoutDay day) =>
        new(
            day.Id,
            day.Name,
            day.Exercises.OrderBy(x => x.Order)
                .Select(x => new TemplateExerciseResponse(
                    ExerciseResponse.From(x.Exercise),
                    x.PlannedSets.OrderBy(s => s.Order)
                        .Select(s => new PlannedSetInput(
                            s.TargetRepsMin,
                            s.TargetRepsMax,
                            s.TargetWeight?.Kilograms,
                            s.IsWarmup,
                            s.IsAmrap
                        ))
                        .ToArray()
                ))
                .ToArray()
        );
}
