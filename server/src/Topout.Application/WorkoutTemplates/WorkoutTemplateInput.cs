using Topout.Application.Exercises;
using Topout.Domain.Entities;

namespace Topout.Application.WorkoutTemplates;

public sealed record PlannedSideInput(
    int? TargetRepsMin,
    int? TargetRepsMax,
    decimal? TargetWeightKg
);

public sealed record PlannedSetInput(
    int? TargetRepsMin,
    int? TargetRepsMax,
    decimal? TargetWeightKg,
    bool IsWarmup,
    bool IsAmrap,
    PlannedSideInput? RightTarget = null
);

public sealed record TemplateExerciseInput(
    int ExerciseId,
    IReadOnlyList<PlannedSetInput>? Sets = null
);

public sealed record WorkoutTemplateInput(
    string Name,
    IReadOnlyList<TemplateExerciseInput> Exercises
);
