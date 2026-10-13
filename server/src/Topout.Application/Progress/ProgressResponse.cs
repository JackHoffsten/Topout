using Topout.Application.Abstractions;
using Topout.Application.Common;

namespace Topout.Application.Progress;

public sealed record ExerciseProgressDay(
    DateOnly Date,
    int ExerciseId,
    string Name,
    string Side,
    int Sets,
    int Reps,
    decimal MaxWeightKg,
    decimal VolumeKg
);

public sealed record ClimbingProgressDay(
    DateOnly Date,
    string ClimbingType,
    string GradeSystem,
    string Grade,
    string Environment,
    int Climbs,
    int Sends,
    int Flashes,
    int Attempts
);

public sealed record ProgressResponse(
    IReadOnlyList<ExerciseProgressDay> Exercises,
    IReadOnlyList<ClimbingProgressDay> Climbing
);
