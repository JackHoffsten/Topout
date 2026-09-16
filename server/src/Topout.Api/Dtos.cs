using Topout.Domain;

namespace Topout.Api;

public sealed record CreateExerciseRequest(
    string Name,
    ExerciseCategory Category,
    UnitSystem UnitSystem,
    bool IsCustom,
    Guid UserId);

public sealed record CreateWorkoutRequest(
    Guid ExerciseId,
    DateOnly Date,
    int Sets,
    int RepsPerSet,
    decimal? Weight,
    UnitSystem WeightUnit,
    string? Notes,
    Guid UserId);

public sealed record CreateRouteRequest(
    string Grade,
    GradeSystem GradeSystem,
    ClimbingEnvironment Environment,
    List<ClimbStyle> Styles,
    int Attempts,
    RouteOutcome Outcome,
    bool IsRestDay,
    string? Notes,
    Guid UserId,
    DateOnly Date);

public sealed record CreateGymDayRequest(
    string Name,
    List<Guid> ExerciseIds,
    string? Notes,
    Guid UserId);

public sealed record CreateRestDayRequest(
    DateOnly Date,
    string? Notes,
    Guid UserId,
    bool IsRestDay = true);
