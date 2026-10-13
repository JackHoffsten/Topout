using Topout.Domain.Enums;

namespace Topout.Application.WorkoutLogging;

public sealed record ReplacementSetInput(
    int Order,
    SetSide Side = SetSide.Both,
    bool IsWarmup = false
);

public sealed record ReplaceExerciseInput(
    int ReplacementExerciseId,
    int Order,
    IReadOnlyList<ReplacementSetInput> Sets
);
